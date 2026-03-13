"""Planner：将研究主题拆解为结构化 TODO 任务列表。"""

from __future__ import annotations

import json
import logging
from typing import List

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import Configuration
from graph.state import ResearchState, TodoItem
from prompts import get_current_date, planner_human, planner_system

logger = logging.getLogger(__name__)


class PlanningService:
    """调用 LLM 将研究主题拆解为金融分析子任务。"""

    def __init__(self, config: Configuration) -> None:
        self._llm = ChatOpenAI(
            model=config.llm_model_id,
            api_key=config.llm_api_key,
            base_url=config.llm_base_url,
            timeout=config.llm_timeout,
            temperature=0.0,
        )
        self._chain = (
            ChatPromptTemplate.from_messages(
                [
                    ("system", planner_system),
                    ("human", planner_human),
                ]
            )
            | self._llm
            | JsonOutputParser()
        )

    def plan_todo_list(self, state: ResearchState) -> List[TodoItem]:
        """生成五维度研究任务列表。"""
        result = self._chain.invoke(
            {
                "user_profile": json.dumps(
                    state.get("user_profile") or {}, ensure_ascii=False
                ),
                "current_date": get_current_date(),
                "research_topic": state["topic"],
            }
        )

        tasks_raw = result.get("tasks", []) if isinstance(result, dict) else []
        todo_items: List[TodoItem] = []

        for idx, item in enumerate(tasks_raw, start=1):
            todo_items.append(
                TodoItem(
                    id=item.get("id", idx),
                    title=str(item.get("title") or f"任务 {idx}").strip(),
                    intent=str(item.get("intent") or "").strip(),
                    query=str(item.get("query") or state["topic"]).strip(),
                    status="pending",
                    summary=None,
                    sources_summary=None,
                    source_type=None,
                )
            )

        if not todo_items:
            logger.warning("Planner 未生成任何任务，使用默认兜底任务")
            todo_items = [self._fallback_task(state["topic"])]

        logger.info("Planner 生成 %d 个任务: %s", len(todo_items), [t["title"] for t in todo_items])
        return todo_items

    @staticmethod
    def _fallback_task(topic: str) -> TodoItem:
        return TodoItem(
            id=1,
            title="综合研究",
            intent="全面了解研究标的的基本情况与近期动态",
            query=f"{topic} 最新进展 投资分析",
            status="pending",
            summary=None,
            sources_summary=None,
            source_type=None,
        )
