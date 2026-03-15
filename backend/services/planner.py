"""Planner：将研究主题拆解为结构化 TODO 任务列表，同时解析市场标识。"""

from __future__ import annotations

import json
import logging
from typing import List, TypedDict

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import Configuration
from graph.state import ResearchState, TodoItem
from prompts import get_current_date, planner_human, planner_system

logger = logging.getLogger(__name__)


class PlanResult(TypedDict):
    ticker: str
    company: str
    market: str
    todo_list: List[TodoItem]


class PlanningService:
    """调用 LLM 解析市场信息并拆解研究子任务。"""

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

    def plan(self, state: ResearchState) -> PlanResult:
        """生成研究计划，包括市场解析结果和五维度任务列表。"""
        result = self._chain.invoke(
            {
                "current_date": get_current_date(),
                "research_topic": state["topic"],
            }
        )

        ticker = str(result.get("ticker") or "").strip()
        company = str(result.get("company") or state["topic"]).strip()
        market = str(result.get("market") or "CN").strip().upper()
        if market not in ("CN", "HK", "US"):
            market = "CN"

        tasks_raw = result.get("tasks", []) if isinstance(result, dict) else []
        todo_items: List[TodoItem] = []

        for idx, item in enumerate(tasks_raw, start=1):
            todo_items.append(
                TodoItem(
                    id=item.get("id", idx),
                    title=str(item.get("title") or f"任务 {idx}").strip(),
                    intent=str(item.get("intent") or "").strip(),
                    status="pending",
                    summary=None,
                    sources=None,
                )
            )

        if not todo_items:
            logger.warning("Planner 未生成任何任务，使用默认兜底任务")
            todo_items = [self._fallback_task(state["topic"])]

        logger.info(
            "Planner 解析完成：%s(%s) 市场=%s，共 %d 个任务: %s",
            company, ticker, market, len(todo_items), [t["title"] for t in todo_items],
        )
        return PlanResult(ticker=ticker, company=company, market=market, todo_list=todo_items)

    @staticmethod
    def _fallback_task(topic: str) -> TodoItem:
        return TodoItem(
            id=1,
            title="综合研究",
            intent=f"全面了解 {topic} 的基本情况与近期动态，包括财务状况和市场表现",
            status="pending",
            summary=None,
            sources=None,
        )
