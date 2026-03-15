"""LangGraph StateGraph 组装。"""

from __future__ import annotations

import os

from langgraph.graph import END, StateGraph

from graph.nodes import executor_node, planner_node, reporter_node
from graph.state import ResearchState


def build_graph(checkpointer):
    """构建并编译研究工作流图。

    持久化层：
    - checkpointer（SQLite）：序列化每个节点执行后的 State，支持 interrupt() 恢复
    - 若 langgraph-checkpoint-sqlite 未安装，自动回退到内存 checkpointer
    """

    builder = StateGraph(ResearchState)
    builder.add_node("planner", planner_node)
    builder.add_node("executor", executor_node)
    builder.add_node("reporter", reporter_node)

    builder.set_entry_point("planner")
    builder.add_edge("planner", "executor")
    builder.add_edge("executor", "reporter")
    builder.add_edge("reporter", END)

    return builder.compile(checkpointer=checkpointer)

