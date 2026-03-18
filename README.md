# 股票深度研究助手

基于 LangGraph + FastAPI + Next.js 16 构建的 AI 投研 Agent，支持 A股/港股/美股，多工具协同搜索，两阶段 Human-in-the-Loop 审核，SSE 实时进度推送。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 · TypeScript · Tailwind CSS |
| 后端 | FastAPI · Python |
| Agent | LangGraph StateGraph + Send() 并行 |
| LLM | OpenAI 兼容接口（DeepSeek / Qwen / Gemini 等） |
| 搜索 | Tavily（langchain-tavily 直连） |
| 结构化数据 | AKShare MCP（mcp-aktools） |
| 持久化 | SQLite Checkpointer（断点续研） |

## 项目结构

```
deepresearch/
├── backend/
│   ├── main.py             # FastAPI 入口，SSE 流
│   ├── config.py           # 环境配置
│   ├── prompts.py          # 所有 Agent 提示词
│   ├── graph/
│   │   ├── state.py        # ResearchState / SubAgentState
│   │   ├── nodes.py        # planner / executor / sub_agent / reporter 节点
│   │   └── graph.py        # StateGraph 构建
│   ├── services/
│   │   ├── planner.py      # 任务规划（ReAct Agent + search 工具）
│   │   ├── executor.py     # 单任务执行
│   │   └── reporter.py     # 流式报告生成
│   └── tools/
│       ├── __init__.py     # get_tools / start_mcp / stop_mcp
│       ├── akshare.py      # AKShare MCP 生命周期 + 白名单
│       └── tavily.py       # Tavily 搜索工具配置
└── frontend/
    ├── app/
    │   └── page.tsx        # 主页面（状态机 + SSE 事件处理）
    ├── components/
    │   ├── TaskCardsPanel.tsx   # 并行任务卡片面板
    │   ├── TodoReview.tsx       # 计划审核面板
    │   ├── ProgressTimeline.tsx # 进度时间轴 + 运行日志
    │   └── ReportPanel.tsx      # Markdown 报告渲染
    └── lib/
        ├── api.ts          # streamResearch / resumeResearch
        └── types.ts        # 类型定义
```

## Agent 流程

```
用户输入股票名称或代码
    → Planner（ReAct Agent）：识别股票代码/市场，规划 5 个研究子任务
    → interrupt() #1：前端展示 TODO 列表，等待用户确认/修改/增删
    → 用户确认 → /research/resume 恢复
    → Executor：Send() 并行 fan-out，5 个 Sub-Agent 同时运行
        每个 Sub-Agent（Tavily + AKShare）独立执行，实时推送进度
        结果通过 operator.add 聚合回全局 summaries
    → interrupt() #2：前端展示各任务摘要和来源，等待用户确认
    → 用户点击"生成报告" → /research/resume 恢复
    → Reporter：astream() 流式生成 Markdown 报告，token 级实时推送
    → 前端渲染完整投研报告
```

## 快速启动

### 环境变量

复制 `backend/.env.example` 为 `backend/.env` 并填写：

```env
# LLM（任意 OpenAI-compatible API）
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL_ID=deepseek-chat
LLM_TIMEOUT=60

# Tavily 搜索
TAVILY_API_KEY=tvly-xxxxx

# LangSmith 追踪（可选）
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=lsv2_pt_xxxxx
LANGSMITH_PROJECT="deepresearch"

```

支持 DeepSeek / 阿里百炼(Qwen) / Google Gemini 等，详见 `.env.example`。

### Docker（推荐）

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env 填入 API Key
docker compose up --build
```

访问 [http://localhost:3000](http://localhost:3000)

### 本地开发

**后端**：

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload 
```

**前端**：

```bash
cd frontend
npm install
npm run dev
```
