"""Summarizer：对单个子任务的检索结果进行深度摘要分析。"""

from __future__ import annotations

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import Configuration
from graph.state import ResearchState, TodoItem
from prompts import summarizer_human, summarizer_system
from utils import strip_thinking_tokens, strip_tool_calls


class SummarizationService:
    """将搜索上下文文本转化为结构化投资摘要。"""

    def __init__(self, config: Configuration) -> None:
        self._config = config
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
                    ("system", summarizer_system),
                    ("human", summarizer_human),
                ]
            )
            | self._llm
            | StrOutputParser()
        )

    def summarize_task(
        self,
        state: ResearchState,
        task: TodoItem,
        context: str,
    ) -> str:
        """生成单个子任务的分析摘要。"""
        response = self._chain.invoke(
            {
                "topic": state["topic"],
                "title": task["title"],
                "intent": task["intent"],
                "query": task["query"],
                "context": context,
            }
        )

        text = response.strip()
        if self._config.strip_thinking_tokens:
            text = strip_thinking_tokens(text)
        text = strip_tool_calls(text).strip()

        return text or "暂无可用信息"
