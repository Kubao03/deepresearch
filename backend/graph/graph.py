"""LangGraph StateGraph 组装。"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from graph.nodes import (
    executor_node,
    planner_node,
    reporter_node,
    route_to_sub_agents,
    sub_agent_node,
)
from graph.state import ResearchState


def build_graph(checkpointer):
    """构建并编译研究工作流图。

    拓扑：planner → executor ─(Send × N)─► [sub_agent] → reporter → END

    持久化层：
    - checkpointer（SQLite）：序列化每个节点执行后的 State，支持 interrupt() 恢复
    """

    builder = StateGraph(ResearchState)
    builder.add_node("planner", planner_node)
    builder.add_node("executor", executor_node)
    builder.add_node("sub_agent", sub_agent_node)
    builder.add_node("reporter", reporter_node)

    builder.set_entry_point("planner")
    builder.add_edge("planner", "executor")
    builder.add_conditional_edges("executor", route_to_sub_agents)
    builder.add_edge("sub_agent", "reporter")
    builder.add_edge("reporter", END)

    return builder.compile(checkpointer=checkpointer)
