"""Reporter：整合所有子任务摘要，生成完整投资研究报告。"""

from __future__ import annotations

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import Configuration
from graph.state import ResearchState
from prompts import get_current_date, reporter_human, reporter_system
from utils import strip_thinking_tokens, strip_tool_calls


class ReportingService:
    """将多个子任务的分析摘要整合为完整的投资研究报告。"""

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
                    ("system", reporter_system),
                    ("human", reporter_human),
                ]
            )
            | self._llm
            | StrOutputParser()
        )

    def generate_report(self, state: ResearchState) -> str:
        """生成最终投资研究报告。"""
        tasks_block = self._build_tasks_block(state)

        response = self._chain.invoke(
            {   
                "current_date": get_current_date(),
                "topic": state["topic"],
                "tasks_block": tasks_block,
            }
        )

        text = response.strip()
        if self._config.strip_thinking_tokens:
            text = strip_thinking_tokens(text)
        text = strip_tool_calls(text).strip()

        return text or "报告生成失败，请检查输入。"

    @staticmethod
    def _build_tasks_block(state: ResearchState) -> str:
        """将 summaries 列表格式化为 Reporter 可读的文本块。"""
        if not state.get("summaries"):
            return "暂无可用的子任务分析结果。"

        parts = []
        for s in state["summaries"]:
            source_label = {"web": "公开搜索", "mcp": "结构化数据", "rag": "私有库"}.get(
                s.get("source_type", "web"), "公开搜索"
            )
            parts.append(
                f"### 任务 {s.get('task_id', '?')}：{s.get('task_title', '')}\n"
                f"来源类型：{source_label}\n\n"
                f"{s.get('content', '暂无可用信息')}\n"
            )
        return "\n".join(parts)
