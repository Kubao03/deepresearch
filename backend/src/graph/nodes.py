"""LangGraph 三节点定义：planner → executor → reporter。"""

from __future__ import annotations

import logging

from langgraph.types import interrupt

from graph.state import ResearchState
from services.planner import PlanningService
from services.reporter import ReportingService
from services.search import dispatch_search, prepare_research_context
from services.summarizer import SummarizationService

logger = logging.getLogger(__name__)


def planner_node(state: ResearchState, config: dict) -> dict:
    """将研究主题拆解为结构化 TODO 列表，并通过 interrupt() 等待用户确认。

    interrupt() 触发后：
    - LangGraph 将当前 State 序列化写入 SQLite Checkpointer
    - 图执行暂停，前端收到 __interrupt__ 事件
    - 用户确认/修改后，通过 /research/resume 接口传入 Command(resume=...)
    - 图从此处恢复，reviewed 拿到用户确认的 todo_list
    """
    app_config = config["configurable"]["app_config"]
    planner = PlanningService(app_config)
    todo_list = planner.plan_todo_list(state)

    reviewed = interrupt({"type": "todo_review", "todo_list": todo_list})

    return {"todo_list": reviewed, "research_loop_count": 0}


def executor_node(state: ResearchState, config: dict) -> dict:
    """对 todo_list 中每个子任务执行搜索 + 摘要，结果追加到 summaries。

    operator.add reducer 会将本次的 new_summaries 追加到已有的 summaries，
    因此多次调用（断点续研）不会覆盖之前的结果。
    """
    app_config = config["configurable"]["app_config"]
    summarizer = SummarizationService(app_config)
    new_summaries = []

    for task in state["todo_list"]:
        if task["status"] == "completed":
            continue

        logger.info("执行任务 [%d] %s", task["id"], task["title"])

        search_result, _, answer_text, backend = dispatch_search(
            task["query"], app_config, state["research_loop_count"]
        )

        if not search_result or not search_result.get("results"):
            new_summaries.append(
                {
                    "task_id": task["id"],
                    "task_title": task["title"],
                    "content": "暂无可用信息",
                    "source_type": "web",
                    "sources": [],
                    "sources_summary": "",
                }
            )
            continue

        sources_summary, context = prepare_research_context(
            search_result, answer_text, app_config
        )
        summary_text = summarizer.summarize_task(state, task, context)

        new_summaries.append(
            {
                "task_id": task["id"],
                "task_title": task["title"],
                "content": summary_text,
                "source_type": backend,
                "sources": search_result.get("results", [])[:3],
                "sources_summary": sources_summary,
            }
        )

    return {
        "summaries": new_summaries,
        "research_loop_count": state["research_loop_count"] + 1,
    }


def reporter_node(state: ResearchState, config: dict) -> dict:
    """整合所有子任务摘要，生成最终投资研究报告。"""
    app_config = config["configurable"]["app_config"]
    reporter = ReportingService(app_config)
    report = reporter.generate_report(state)
    return {"final_report": report}
