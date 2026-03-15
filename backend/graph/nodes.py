"""LangGraph 三节点定义：planner → executor → reporter。"""

from __future__ import annotations

import logging

from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from langgraph.types import interrupt

from graph.state import ResearchState
from services.planner import PlanningService
from services.reporter import ReportingService
from services.executor import ExecutionService

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
        "research_loop_count": 0,
    }


async def executor_node(state: ResearchState, config: RunnableConfig) -> dict:
    """对 todo_list 中每个子任务运行 Sub-Agent，结果追加到 summaries。"""
    app_config = config["configurable"]["app_config"]
    writer = get_stream_writer()
    executor = ExecutionService(app_config)

    summaries = await executor.run_tasks(
        state,
        on_task_start=writer,
        on_task_done=writer,
    )

    return {
        "summaries": summaries,
        "research_loop_count": state["research_loop_count"] + 1,
    }


def reporter_node(state: ResearchState, config: RunnableConfig) -> dict:
    """整合所有子任务摘要，生成最终投资研究报告。"""
    app_config = config["configurable"]["app_config"]
    reporter = ReportingService(app_config)
    report = reporter.generate_report(state)
    return {"final_report": report}
