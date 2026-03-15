"""LangGraph 三节点定义：planner → executor → reporter。"""

from __future__ import annotations

import json
import logging
import re

from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.config import get_stream_writer
from langgraph.types import interrupt

from graph.state import ResearchState
from prompts import sub_agent_human, sub_agent_system
from services.planner import PlanningService
from services.reporter import ReportingService

logger = logging.getLogger(__name__)


def planner_node(state: ResearchState, config: RunnableConfig) -> dict:
    """将研究主题拆解为结构化 TODO 列表，并通过 interrupt() 等待用户确认。"""
    app_config = config["configurable"]["app_config"]
    planner = PlanningService(app_config)
    plan_result = planner.plan(state)

    reviewed = interrupt({
        "type": "todo_review",
        "todo_list": plan_result["todo_list"],
        "ticker": plan_result["ticker"],
        "company": plan_result["company"],
        "market": plan_result["market"],
    })

    return {
        "ticker": plan_result["ticker"],
        "company": plan_result["company"],
        "market": plan_result["market"],
        "todo_list": reviewed,
        "research_loop_count": 0,
    }


async def executor_node(state: ResearchState, config: RunnableConfig) -> dict:
    """对 todo_list 中每个子任务运行 Sub-Agent（LLM + MCP 工具），结果追加到 summaries。

    Sub-Agent 自主决定调用 tavily-mcp（网络搜索）或 mcp-aktools（结构化数据），顺序执行。
    """
    from langchain.agents import create_agent
    from tools.mcp_client import get_tools

    app_config = config["configurable"]["app_config"]
    writer = get_stream_writer()

    llm = ChatOpenAI(
        model=app_config.llm_model_id,
        api_key=app_config.llm_api_key,
        base_url=app_config.llm_base_url,
        timeout=app_config.llm_timeout,
        temperature=0.0,
    )

    tools = get_tools()
    agent = create_agent(llm, tools, system_prompt=sub_agent_system)

    ticker = state.get("ticker", "")
    company = state.get("company", state["topic"])
    market = state.get("market", "CN")

    todo = state["todo_list"]
    total = sum(1 for t in todo if t["status"] != "completed")
    done_count = 0
    new_summaries = []

    for task in todo:
        if task["status"] == "completed":
            continue

        logger.info("执行任务 [%d] %s", task["id"], task["title"])
        writer({
            "type": "task_start",
            "task_id": task["id"],
            "task_title": task["title"],
            "current": done_count + 1,
            "total": total,
        })

        human_msg = sub_agent_human.format(
            company=company,
            ticker=ticker,
            market=market,
            title=task["title"],
            intent=task["intent"],
        )

        summary_text = "暂无可用信息"
        sources: list = []

        try:
            result = await agent.ainvoke({"messages": [HumanMessage(content=human_msg)]})
            raw_content = result["messages"][-1].content
            parsed = _parse_agent_response(raw_content)
            summary_text = parsed.get("summary") or raw_content
            sources = parsed.get("sources") or []
        except Exception as exc:
            logger.exception("任务 [%d] Sub-Agent 执行失败：%s", task["id"], exc)

        new_summaries.append({
            "task_id": task["id"],
            "task_title": task["title"],
            "content": summary_text,
            "sources": sources,
        })
        done_count += 1
        writer({
            "type": "task_done",
            "task_id": task["id"],
            "task_title": task["title"],
            "current": done_count,
            "total": total,
        })

    return {
        "summaries": new_summaries,
        "research_loop_count": state["research_loop_count"] + 1,
    }


def reporter_node(state: ResearchState, config: RunnableConfig) -> dict:
    """整合所有子任务摘要，生成最终投资研究报告。"""
    app_config = config["configurable"]["app_config"]
    reporter = ReportingService(app_config)
    report = reporter.generate_report(state)
    return {"final_report": report}


# ── 内部工具 ──────────────────────────────────────────────────────────────────

def _parse_agent_response(content: str) -> dict:
    """从 Sub-Agent 最终消息中提取 JSON 响应 {"summary": ..., "sources": [...]}。"""
    # 直接解析
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        pass
    # 从 markdown 代码块中提取
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            pass
    return {}
