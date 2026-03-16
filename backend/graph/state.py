"""LangGraph 全局状态定义。"""

from __future__ import annotations

import operator
from typing import Annotated, List, TypedDict


class TodoItem(TypedDict):
    """单个研究子任务。"""

    id: int
    title: str
    intent: str    # 本任务目标（Sub-Agent 自主决定工具调用参数）
    status: str    # pending / in_progress / completed / skipped


class ResearchState(TypedDict):
    """贯穿整个工作流的全局状态容器。"""

    # 用户输入
    topic: str

    # Planner 解析并写入，Executor / Sub-Agent 读取
    ticker: str    # 股票代码，如 "600519" / "0700.HK" / "AAPL"
    company: str   # 公司名称，如 "贵州茅台"
    market: str    # 市场类型：CN / HK / US

    # Planner 写入，Executor 读取
    todo_list: List[TodoItem]

    # Sub-Agent 逐任务追加（operator.add 保证并发安全）
    summaries: Annotated[List[dict], operator.add]

    # Reporter 写入
    final_report: str

    # 流程控制
    thread_id: str


class SubAgentState(TypedDict):
    """Send API 分发给每个并行 Sub-Agent 的局部状态。"""

    task: TodoItem
    ticker: str
    company: str
    market: str
    total: int       # 本轮并行任务总数（用于前端进度显示）
    task_index: int  # 当前任务在 todo_list 中的序号（0-based）
