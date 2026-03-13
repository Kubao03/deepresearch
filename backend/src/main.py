"""FastAPI 入口：暴露研究流程的 HTTP 接口。"""

from __future__ import annotations

import json
import sys
import time
from typing import Any, Iterator, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field

from config import Configuration, SearchAPI
from graph.graph import build_graph

# ── 日志 ──────────────────────────────────────────────────────────────────────
logger.add(
    sys.stderr,
    level="INFO",
    format="<green>{time:HH:mm:ss}</green> | <level>{level:<5}</level> | <cyan>{function}</cyan> | <level>{message}</level>",
    colorize=True,
)

# ── 全局图实例（应用启动时构建一次）─────────────────────────────────────────────
graph = build_graph(db_path="./data")


# ── 请求模型 ───────────────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    topic: str = Field(..., description="研究主题或股票代码")
    search_api: Optional[SearchAPI] = Field(default=None, description="覆盖默认搜索后端")


class ResumeRequest(BaseModel):
    thread_id: str = Field(..., description="待恢复的研究线程 ID")
    reviewed_todo_list: List[dict] = Field(..., description="用户确认/修改后的 TODO 列表")


# ── 辅助函数 ──────────────────────────────────────────────────────────────────

def _build_config(thread_id: str, search_api: Optional[SearchAPI] = None) -> dict:
    overrides = {"search_api": search_api.value} if search_api else {}
    return {
        "configurable": {
            "thread_id": thread_id,
            "app_config": Configuration.from_env(overrides=overrides),
        }
    }


def _sse(payload: Any) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ── 应用工厂 ──────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(title="A股深度研究助手")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def health() -> dict:
        return {"status": "ok"}

    @app.post("/research/stream")
    def stream_research(payload: ResearchRequest) -> StreamingResponse:
        """启动研究流程，以 SSE 流式推送进度。

        流程：
        1. 向图注入初始 State（topic + 空 summaries）
        2. Planner 生成 TODO 后触发 interrupt()，前端收到 __interrupt__ 事件
        3. 用户确认后调用 /research/resume 继续执行
        """
        thread_id = f"{payload.topic}-{int(time.time())}"
        config = _build_config(thread_id, payload.search_api)

        initial_state = {
            "topic": payload.topic,
            "user_profile": {},
            "todo_list": [],
            "summaries": [],
            "final_report": "",
            "research_loop_count": 0,
            "thread_id": thread_id,
        }

        def event_stream() -> Iterator[str]:
            yield _sse({"type": "thread_id", "thread_id": thread_id})
            try:
                for event in graph.stream(
                    initial_state, config=config, stream_mode="updates"
                ):
                    yield _sse(event)
            except Exception as exc:
                logger.exception("研究流程异常")
                yield _sse({"type": "error", "detail": str(exc)})

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    @app.post("/research/resume")
    def resume_research(payload: ResumeRequest) -> StreamingResponse:
        """Human Review 确认后，恢复暂停的研究流程。

        将用户确认的 todo_list 通过 Command(resume=...) 注入，
        图从 interrupt() 处继续执行 executor → reporter。
        """
        from langgraph.types import Command

        config = _build_config(payload.thread_id)

        def event_stream() -> Iterator[str]:
            try:
                for event in graph.stream(
                    Command(resume=payload.reviewed_todo_list),
                    config=config,
                    stream_mode="updates",
                ):
                    yield _sse(event)
            except Exception as exc:
                logger.exception("恢复流程异常")
                yield _sse({"type": "error", "detail": str(exc)})

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
