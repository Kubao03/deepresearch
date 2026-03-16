"""LangGraph 节点定义：planner → executor → [sub_agent × N] → reporter。"""

from __future__ import annotations

import logging

from langchain_core.runnables import RunnableConfig
from langgraph.types import Send, StreamWriter, interrupt

from graph.state import ResearchState, SubAgentState
from services.executor import ExecutionService
from services.planner import PlanningService
from services.reporter import ReportingService

logger = logging.getLogger(__name__)


async def planner_node(state: ResearchState, config: RunnableConfig) -> dict:
    """将研究主题拆解为结构化 TODO 列表，并通过 interrupt() 等待用户确认。"""
    app_config = config["configurable"]["app_config"]
    planner = PlanningService(app_config)
    plan_result = await planner.plan(state)

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
    }


def executor_node(state: ResearchState) -> dict:
    """空节点，仅作为 Send fan-out 的触发点。"""
    return {}


def route_to_sub_agents(state: ResearchState) -> list[Send]:
    """Conditional edge path function：为每个 pending 任务生成一个并行 Send。"""
    pending = [
        (i, t)
        for i, t in enumerate(state["todo_list"])
        if t["status"] != "completed"
    ]
    total = len(pending)
    return [
        Send("sub_agent", SubAgentState(
            task=task,
            ticker=state.get("ticker", ""),
            company=state.get("company", state["topic"]),
            market=state.get("market", "CN"),
            total=total,
            task_index=idx,
        ))
        for idx, task in pending
    ]


async def sub_agent_node(
    state: SubAgentState,
    writer: StreamWriter,
    config: RunnableConfig,
) -> dict:
    """并行运行单个 Sub-Agent，通过 writer 推送实时进度，结果追加到全局 summaries。"""
    app_config = config["configurable"]["app_config"]
    task = state["task"]

    writer({
        "type": "task_start",
        "task_id": task["id"],
        "task_title": task["title"],
        "task_index": state["task_index"],
        "total": state["total"],
    })

    logger.info("并行执行任务 [%d/%d] %s", state["task_index"] + 1, state["total"], task["title"])

    executor = ExecutionService(app_config)
    summary_text, sources = await executor.run_single(
        task, state["company"], state["ticker"], state["market"]
    )

    writer({
        "type": "task_done",
        "task_id": task["id"],
        "task_title": task["title"],
        "task_index": state["task_index"],
        "total": state["total"],
    })

    return {
        "summaries": [{
            "task_id": task["id"],
            "task_title": task["title"],
            "content": summary_text,
            "sources": sources,
        }]
    }


async def reporter_node(state: ResearchState, writer: StreamWriter, config: RunnableConfig) -> dict:
    """等待用户确认后，流式生成最终投资研究报告。"""
    interrupt({"type": "results_review"})

    app_config = config["configurable"]["app_config"]
    reporter = ReportingService(app_config)
    report = await reporter.generate_report_stream(state, writer)
    return {"final_report": report}
