"""ExecutionService：运行单个 Sub-Agent，返回摘要与来源。"""

from __future__ import annotations

import json
import logging
import re

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from config import Configuration
from graph.state import TodoItem
from prompts import get_current_date, sub_agent_human, sub_agent_system

logger = logging.getLogger(__name__)


class ExecutionService:
    """为单个研究子任务运行 Sub-Agent（LLM + 工具），收集摘要与来源。"""

    def __init__(self, config: Configuration) -> None:
        self._config = config

    async def run_single(self, task: TodoItem, company: str, ticker: str, market: str) -> tuple[str, list]:
        """
        为一个子任务创建 Sub-Agent 并执行，返回 (summary_text, sources)。
        供 sub_agent_node 调用，每个并行任务独立建立 LLM / Agent 实例。
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
        return await self._run_single(agent, task, company, ticker, market)

    async def _run_single(self, agent, task: TodoItem, company: str, ticker: str, market: str) -> tuple[str, list]:
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
    """从 Sub-Agent 最终消息中提取 JSON。

    依次尝试三种格式：
    1. 整段内容就是 JSON
    2. ```json ... ``` 代码块
    3. 文字末尾跟着裸 JSON 对象（取最后一个 { 到末尾）
    """
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

    match = re.search(r'\{\s*"summary"\s*:', content)
    if match:
        try:
            return json.loads(content[match.start():])
        except (json.JSONDecodeError, TypeError):
            pass

    return {}
