"""tools 包对外统一入口。"""

from tools.akshare import start as start_mcp, stop as stop_mcp
from tools.akshare import get_tools as _get_akshare_tools
from tools.tavily import get_tools as _get_tavily_tools


def get_tools() -> list:
    """返回所有可用工具（AKShare + Tavily）。"""
    return _get_akshare_tools() + _get_tavily_tools()


__all__ = ["start_mcp", "stop_mcp", "get_tools"]
