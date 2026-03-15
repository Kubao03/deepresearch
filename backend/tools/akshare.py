"""AKShare MCP 客户端：管理 aktools 服务的生命周期。"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# 白名单：只有这些工具会暴露给 Agent
TOOL_WHITELIST: set[str] = {
    # "search",
    "stock_indicators_us",
    "stock_indicators_hk",
    "stock_indicators_a",
    "stock_prices",
    "stock_news_global",
}
_all_tools: list = []
_tools: list = []


async def start() -> None:
    """应用启动时调用，初始化 AKShare MCP 客户端。"""
    global _tools, _all_tools

    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient

        client = MultiServerMCPClient({
            "aktools": {
                "command": "uvx",
                "args": ["mcp-aktools"],
                "transport": "stdio",
            }
        })

        _all_tools = await client.get_tools(server_name="aktools")
        _tools = [t for t in _all_tools if t.name in TOOL_WHITELIST]
        enabled = [t.name for t in _tools]
        logger.info("MCP[aktools] 已启动，启用工具：%s", enabled)

    except Exception as exc:
        logger.error("MCP[aktools] 启动失败：%s", exc)
        _tools = []


async def stop() -> None:
    """应用关闭时调用，清理工具列表。"""
    global _tools
    _tools = []
    logger.info("MCP[aktools] 已停止")


def get_tools() -> list:
    """返回白名单内的 AKShare 工具列表。"""
    return list(_tools)


def get_tool(name: str):
    """按名称返回单个工具，不存在则返回 None。"""
    for tool in _all_tools:
        if tool.name == name:
            return tool
    return None
