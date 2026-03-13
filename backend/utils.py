"""通用工具函数。"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

CHARS_PER_TOKEN = 4


def strip_thinking_tokens(text: str) -> str:
    """移除模型输出中的 <think>...</think> 推理块。"""
    while "<think>" in text and "</think>" in text:
        start = text.find("<think>")
        end = text.find("</think>") + len("</think>")
        text = text[:start] + text[end:]
    return text


def strip_tool_calls(text: str) -> str:
    """移除文本中残留的 [TOOL_CALL:...] 标记。"""
    if not text:
        return text
    return re.compile(r"\[TOOL_CALL:[^\]]+\]").sub("", text)


def format_sources(search_results: Dict[str, Any] | None) -> str:
    """将搜索结果格式化为带链接的来源列表。"""
    if not search_results:
        return ""
    results = search_results.get("results", [])
    return "\n".join(
        f"* {item.get('title', item.get('url', ''))} : {item.get('url', '')}"
        for item in results
        if item.get("url")
    )


def deduplicate_and_format_sources(
    search_response: Dict[str, Any] | List[Dict[str, Any]],
    max_tokens_per_source: int,
    *,
    fetch_full_page: bool = False,
) -> str:
    """去重并格式化搜索结果，供 LLM 作为上下文使用。"""
    sources_list: list = (
        search_response.get("results", [])
        if isinstance(search_response, dict)
        else search_response
    )

    # URL 去重
    seen: dict[str, Dict[str, Any]] = {}
    for s in sources_list:
        url = s.get("url")
        if url and url not in seen:
            seen[url] = s

    parts: List[str] = []
    for source in seen.values():
        title = source.get("title") or source.get("url", "")
        content = source.get("content", "")
        parts.append(f"来源：{title}\nURL：{source.get('url', '')}\n内容：{content}\n")

        if fetch_full_page:
            raw = source.get("raw_content") or ""
            char_limit = max_tokens_per_source * CHARS_PER_TOKEN
            if len(raw) > char_limit:
                raw = f"{raw[:char_limit]}... [truncated]"
            if raw:
                parts.append(f"详细内容：{raw}\n")

    return "\n".join(parts).strip()
