"""MCP 客户端：统一管理 AKShare 和 Tavily MCP 服务的生命周期。

使用新版 langchain-mcp-adapters API：
  - 直接 await client.get_tools()，不用 async with / __aenter__
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# 按服务器名存储工具列表，key 为服务器名 ("tavily" / "aktools")
_server_tools: dict[str, list] = {}


async def start_mcp() -> None:
    """应用启动时调用，初始化 MCP 客户端并按服务器加载工具列表。"""
    global _server_tools

    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient

        servers: dict = {}

        # AKShare MCP —— A/港/美股结构化财务与行情数据
        servers["aktools"] = {
            "command": "uvx",
            "args": ["mcp-aktools"],
            "transport": "stdio",
        }

        # Tavily MCP —— 互联网实时搜索
        tavily_key = os.environ.get("TAVILY_API_KEY")
        if tavily_key:
            servers["tavily"] = {
                "command": "npx",
                "args": ["-y", "tavily-mcp@latest"],
                "transport": "stdio",
                "env": {"TAVILY_API_KEY": tavily_key},
            }
        else:
            logger.warning("TAVILY_API_KEY 未设置，tavily-mcp 将不启动")

        client = MultiServerMCPClient(servers)

        # 按服务器分别加载，失败不影响其他服务器
        for server_name in servers:
            try:
                tools = await client.get_tools(server_name=server_name)
                _server_tools[server_name] = tools
                logger.info("MCP[%s] 已就绪，工具：%s", server_name, [t.name for t in tools])
            except Exception as exc:
                logger.warning("MCP[%s] 加载失败：%s", server_name, exc)
                _server_tools[server_name] = []

    except Exception as exc:
        logger.error("MCP 启动失败，将回退到直接搜索模式：%s", exc)
        _server_tools = {}


async def stop_mcp() -> None:
    """应用关闭时调用，清理工具列表。"""
    global _server_tools
    _server_tools = {}
    logger.info("MCP 已停止")


def get_tools() -> list:
    """返回所有服务器的工具列表（合并）。"""
    result: list = []
    for tools in _server_tools.values():
        result.extend(tools)
    return result


def get_server_tools(server: str) -> list:
    """返回指定服务器的工具列表。server 为 'tavily' 或 'aktools'。"""
    return _server_tools.get(server, [])
