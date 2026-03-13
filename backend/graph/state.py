"""LangGraph 全局状态定义。"""

from __future__ import annotations

import operator
from typing import Annotated, List, Optional, TypedDict


class TodoItem(TypedDict):
    """单个研究子任务。"""

    id: int 
    title: str
    intent: str 
    query: str 
    status: str              # pending / in_progress / completed / skipped
    summary: Optional[str] # 任务完成后由 Executor 填写，供 Reporter 汇总使用
    sources_summary: Optional[str] # 任务完成后由 Executor 填写，供 Reporter 汇总使用
    source_type: Optional[str]  # web / mcp / rag


class ResearchState(TypedDict):
    """贯穿整个工作流的全局状态容器。"""

    # 输入
    topic: str
    user_profile: dict

    # Planner 写入，Executor 读取
    todo_list: List[TodoItem]

    # Executor 逐任务追加（operator.add 保证并发安全）
    summaries: Annotated[List[dict], operator.add]

    # Reporter 写入
    final_report: str

    # 流程控制
    research_loop_count: int
    thread_id: str
