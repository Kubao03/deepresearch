"""Tavily 搜索工具：使用 langchain-tavily 包。"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def get_tools() -> list:
    """返回 Tavily 搜索工具，未配置 API Key 时返回空列表。"""
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if not tavily_key:
        logger.warning("TAVILY_API_KEY 未设置，Tavily 工具不可用")
        return []

    from langchain_tavily import TavilySearch

    logger.info("Tavily 工具已加载")
    return [TavilySearch(
        max_results=3,
        search_depth="basic",      # basic 比 advanced 省 token
        include_raw_content=False, # 不要原始 HTML
        include_images=False,
    )]
