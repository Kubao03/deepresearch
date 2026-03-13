"""搜索调度层：封装 DuckDuckGo / Tavily，统一输出格式。

后续扩展：在 dispatch_search() 内部增加 mcp 分支，
接入 tavily-mcp（搜索）和 mcp-aktools（A股数据），调用方无需修改。
"""

from __future__ import annotations

import logging
from typing import Any, Optional, Tuple

from config import Configuration
from utils import deduplicate_and_format_sources, format_sources

logger = logging.getLogger(__name__)

MAX_TOKENS_PER_SOURCE = 2000


def dispatch_search(
    query: str,
    config: Configuration,
    loop_count: int,
) -> Tuple[dict[str, Any] | None, list[str], Optional[str], str]:
    """执行搜索，返回统一格式的四元组。

    Returns:
        payload       - {"results": [...], "backend": str, "answer": str|None}
        notices       - 搜索过程提示列表
        answer_text   - 部分引擎返回的直接答案（可为 None）
        backend_label - 实际使用的后端名称
    """
    search_api = config.search_api.value

    try:
        if search_api == "duckduckgo":
            payload = _duckduckgo_search(query)
        elif search_api == "tavily":
            payload = _tavily_search(query)
        else:
            logger.warning("未知后端 %s，回退到 duckduckgo", search_api)
            payload = _duckduckgo_search(query)
    except Exception as exc:
        logger.exception("搜索失败 backend=%s: %s", search_api, exc)
        raise

    notices: list[str] = payload.get("notices") or []
    answer_text: Optional[str] = payload.get("answer")
    backend_label: str = payload.get("backend", search_api)

    logger.info(
        "搜索完成 backend=%s results=%d loop=%d",
        backend_label,
        len(payload.get("results", [])),
        loop_count,
    )
    return payload, notices, answer_text, backend_label


def prepare_research_context(
    search_result: dict[str, Any] | None,
    answer_text: Optional[str],
    config: Configuration,
) -> tuple[str, str]:
    """将搜索结果转为 (来源列表文本, LLM 上下文文本)。"""
    sources_summary = format_sources(search_result)
    context = deduplicate_and_format_sources(
        search_result or {"results": []},
        max_tokens_per_source=MAX_TOKENS_PER_SOURCE,
        fetch_full_page=config.fetch_full_page,
    )
    if answer_text:
        context = f"AI 直接答案：\n{answer_text}\n\n{context}"
    return sources_summary, context


# ── 后端实现 ──────────────────────────────────────────────────────────────────

def _duckduckgo_search(query: str, max_results: int = 5) -> dict[str, Any]:
    from duckduckgo_search import DDGS

    with DDGS() as ddgs:
        raw = list(ddgs.text(query, max_results=max_results))

    results = [
        {"title": r.get("title", ""), "url": r.get("href", ""), "content": r.get("body", "")}
        for r in raw
    ]
    return {"results": results, "backend": "duckduckgo", "answer": None, "notices": []}


def _tavily_search(query: str, max_results: int = 5) -> dict[str, Any]:
    import os

    from tavily import TavilyClient

    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise ValueError("TAVILY_API_KEY 未设置")

    client = TavilyClient(api_key=api_key)
    resp = client.search(query, max_results=max_results)
    results = [
        {"title": r.get("title", ""), "url": r.get("url", ""), "content": r.get("content", "")}
        for r in resp.get("results", [])
    ]
    return {"results": results, "backend": "tavily", "answer": resp.get("answer"), "notices": []}
