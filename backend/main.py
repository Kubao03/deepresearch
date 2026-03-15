"""FastAPI 入口：暴露研究流程的 HTTP 接口。"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field

from config import Configuration
from graph.graph import build_graph
from tools import start_mcp, stop_mcp

# ── 日志 ──────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)



# ── 请求模型 ───────────────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    topic: str = Field(..., description="研究主题或股票代码")


class ResumeRequest(BaseModel):
    thread_id: str = Field(..., description="待恢复的研究线程 ID")
    reviewed_todo_list: List[dict] = Field(..., description="用户确认/修改后的 TODO 列表")


# ── 辅助函数 ──────────────────────────────────────────────────────────────────

def _build_config(thread_id: str) -> dict:
    return {
        "configurable": {
            "thread_id": thread_id,
            "app_config": Configuration.from_env(),
        }
    }


def _json_default(obj: Any) -> Any:
    """处理 LangGraph 内部类型（如 Interrupt）的 JSON 序列化。"""
    try:
        from langgraph.types import Interrupt
        if isinstance(obj, Interrupt):
            return {"value": obj.value, "id": obj.id}
    except ImportError:
        pass
    return str(obj)


def _sse(payload: Any) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False, default=_json_default)}\n\n"


# ── 应用工厂 ──────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:

    @asynccontextmanager
    async def lifespan(app: FastAPI):

        db_path = "./data"
        os.makedirs(db_path, exist_ok=True)
        db_file = os.path.join(db_path, "checkpoints.db")

        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
        
        # 开启异步 SQLite 连接
        async with AsyncSqliteSaver.from_conn_string(db_file) as saver:
            # 3. 这里是“组装”的地方
            # 调用普通的 build_graph，传入 saver
            app.state.graph = build_graph(saver) 
            
            logger.info("🚀 系统已就绪，数据库连接已开启")
            await start_mcp()
            yield # 只要服务器开着，程序就停在这里，saver 也会一直保持连接
            await stop_mcp()

    app = FastAPI(title="A股深度研究助手", lifespan=lifespan)

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
    async def stream_research(payload: ResearchRequest) -> StreamingResponse:
        graph = app.state.graph
        """启动研究流程，以 SSE 流式推送进度。"""
        thread_id = f"{payload.topic}-{int(time.time())}"
        config = _build_config(thread_id)

        initial_state = {
            "topic": payload.topic,
            "todo_list": [],
            "summaries": [],
            "final_report": "",
            "research_loop_count": 0,
            "thread_id": thread_id,
        }

        async def event_stream() -> AsyncIterator[str]:
            yield _sse({"type": "thread_id", "thread_id": thread_id})
            try:
                async for event in graph.astream(
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
    async def resume_research(payload: ResumeRequest) -> StreamingResponse:
        """Human Review 确认后，恢复暂停的研究流程。"""
        from langgraph.types import Command
        graph = app.state.graph
        config = _build_config(payload.thread_id)

        async def event_stream() -> AsyncIterator[str]:
            yield _sse({"type": "resume_start"})
            try:
                async for _, event in graph.astream(
                    Command(resume=payload.reviewed_todo_list),
                    config=config,
                    stream_mode=["updates", "custom"],
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
