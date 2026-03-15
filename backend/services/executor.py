"""ExecutionService：对每个子任务运行 Sub-Agent，返回摘要与来源。"""

from __future__ import annotations

import json
import logging
import re
from typing import List

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from config import Configuration
from graph.state import ResearchState, TodoItem
from prompts import get_current_date, sub_agent_human, sub_agent_system

logger = logging.getLogger(__name__)


class ExecutionService:
    """为每个研究子任务运行 Sub-Agent（LLM + 工具），收集摘要与来源。"""

    def __init__(self, config: Configuration) -> None:
        self._config = config

    async def run_tasks(
        self,
        state: ResearchState,
        on_task_start=None,
        on_task_done=None,
    ) -> List[dict]:
        """
        顺序执行 todo_list 中所有 pending 任务。

        on_task_start / on_task_done：可选回调，接收任务进度信息 dict，
        供 executor_node 通过 stream_writer 推送前端进度。
        """
        from langchain.agents import create_agent
        from tools import get_tools

        llm = ChatOpenAI(
            model=self._config.llm_model_id,
            api_key=self._config.llm_api_key,
            base_url=self._config.llm_base_url,
            timeout=self._config.llm_timeout,
            temperature=0.0,
        )

        agent = create_agent(llm, get_tools(), system_prompt=sub_agent_system)

        ticker = state.get("ticker", "")
        company = state.get("company", state["topic"])
        market = state.get("market", "CN")

        todo = state["todo_list"]
        total = sum(1 for t in todo if t["status"] != "completed")
        done_count = 0
        summaries: List[dict] = []

        for task in todo:
            if task["status"] == "completed":
                continue

            logger.info("执行任务 [%d] %s", task["id"], task["title"])
            if on_task_start:
                on_task_start({"type": "task_start", "task_id": task["id"],
                               "task_title": task["title"], "current": done_count + 1, "total": total})

            summary_text, sources = await self._run_single(agent, task, company, ticker, market)

            summaries.append({
                "task_id": task["id"],
                "task_title": task["title"],
                "content": summary_text,
                "sources": sources,
            })
            done_count += 1
            if on_task_done:
                on_task_done({"type": "task_done", "task_id": task["id"],
                              "task_title": task["title"], "current": done_count, "total": total})

        return summaries

    async def _run_single(self, agent, task: TodoItem, company: str, ticker: str, market: str):
        """运行单个子任务，返回 (summary_text, sources)。"""
        human_msg = sub_agent_human.format(
            current_date=get_current_date(),
            company=company,
            ticker=ticker,
            market=market,
            title=task["title"],
            intent=task["intent"],
        )
        try:
            result = await agent.ainvoke(
                {"messages": [HumanMessage(content=human_msg)]},
                config={"recursion_limit": 11},
            )
            raw = result["messages"][-1].content
            parsed = _parse_json(raw)
            return parsed.get("summary") or raw, parsed.get("sources") or []
        except Exception as exc:
            logger.exception("任务 [%d] Sub-Agent 执行失败：%s", task["id"], exc)
            return "暂无可用信息", []


def _parse_json(content: str) -> dict:
    """从 Sub-Agent 最终消息中提取 JSON。"""
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            pass
    return {}
