"""运行时配置管理。"""

from __future__ import annotations

import os
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).parent / ".env")


class SearchAPI(Enum):
    DUCKDUCKGO = "duckduckgo"
    TAVILY = "tavily"


class Configuration(BaseModel):
    """深度研究助手的运行时配置。

    LLM 支持任何 OpenAI-compatible 接口：
      - DeepSeek: base_url=https://api.deepseek.com/v1
      - 阿里百炼:  base_url=https://dashscope.aliyuncs.com/compatible-mode/v1
      - Gemini:    base_url=https://generativelanguage.googleapis.com/v1beta/openai/
    """

    # LLM
    llm_model_id: str = Field(default="deepseek-chat")
    llm_api_key: Optional[str] = Field(default=None)
    llm_base_url: Optional[str] = Field(default=None)
    llm_timeout: int = Field(default=60)

    # 搜索
    search_api: SearchAPI = Field(default=SearchAPI.DUCKDUCKGO)
    fetch_full_page: bool = Field(default=True)

    # 输出处理
    strip_thinking_tokens: bool = Field(default=True)

    @classmethod
    def from_env(cls, overrides: Optional[dict[str, Any]] = None) -> "Configuration":
        """从环境变量构建配置，overrides 可覆盖任意字段。"""
        raw: dict[str, Any] = {}

        env_map = {
            "llm_model_id": "LLM_MODEL_ID",
            "llm_api_key": "LLM_API_KEY",
            "llm_base_url": "LLM_BASE_URL",
            "llm_timeout": "LLM_TIMEOUT",
            "search_api": "SEARCH_API",
            "fetch_full_page": "FETCH_FULL_PAGE",
            "strip_thinking_tokens": "STRIP_THINKING_TOKENS",
        }
        for field_name, env_key in env_map.items():
            val = os.getenv(env_key)
            if val is not None:
                raw[field_name] = val

        if overrides:
            raw.update({k: v for k, v in overrides.items() if v is not None})

        return cls(**raw)
