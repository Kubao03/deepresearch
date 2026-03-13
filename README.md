# A股深度研究助手

基于 LangGraph + FastAPI + Next.js 14 构建的 AI 投研 Agent，支持多轮搜索、人工审核、SSE 实时进度推送。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 · TypeScript · Tailwind CSS |
| 后端 | FastAPI · Python |
| Agent | LangGraph StateGraph |
| LLM | DeepSeek（OpenAI 兼容接口） |
| 搜索 | DuckDuckGo / Tavily |
| 记忆 | SQLite Checkpointer（断点续研） |

## 项目结构

```
stockresearch/
├── backend/
│   ├── main.py           # FastAPI 入口
│   ├── config.py         # 环境配置
│   ├── prompts.py        # LLM 提示词
│   ├── utils.py          # 工具函数
│   ├── graph/
│   │   ├── state.py      # ResearchState 定义
│   │   ├── nodes.py      # planner / executor / reporter 节点
│   │   └── graph.py      # StateGraph 构建
│   ├── services/
│   │   ├── planner.py    # 任务规划服务
│   │   ├── summarizer.py # 搜索结果摘要
│   │   ├── reporter.py   # 报告生成服务
│   │   └── search.py     # 搜索调度（DuckDuckGo / Tavily）
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── page.tsx      # 主页面（SSE 流 + Human Review UI）
    │   └── layout.tsx
    └── lib/
        └── api.ts        # streamResearch / resumeResearch
```

## Agent 流程

```
用户输入主题
    → Planner 节点：规划 5 个研究子任务
    → interrupt()：暂停，前端展示 TODO 列表等待用户确认
    → 用户确认/修改后 /research/resume 恢复
    → Executor 节点：逐任务搜索 + LLM 摘要（实时进度推送）
    → Reporter 节点：整合摘要生成投研报告
    → 前端渲染 Markdown 报告
```

## 已实现功能（第二阶段）

- [x] LangGraph StateGraph 三节点架构（Planner → Executor → Reporter）
- [x] Human-in-the-Loop：`interrupt()` + SQLite Checkpointer 断点续研
- [x] SSE 实时流：`/research/stream` 启动，`/research/resume` 恢复
- [x] Executor 逐任务实时进度（`get_stream_writer`）
- [x] Next.js 14 前端，暗色主题，响应式两栏布局
- [x] TODO 列表人工审核面板（可编辑/增删/跳过任务）
- [x] Markdown 报告渲染 + 一键复制

## 待实现（后续阶段）

- [ ] MCP 工具层（mcp-aktools A股数据 + tavily-mcp）
- [ ] RAG 知识库（Chroma + BM25 混合检索）
- [ ] 用户偏好长期记忆（SQLite Store）
- [ ] PDF 上传与文档摘入管道
- [ ] LangSmith 可观测性
- [ ] Docker Compose 一键部署

## 快速启动

**环境变量**（`backend/.env`）：

```env
LLM_API_KEY=your_deepseek_key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL_ID=deepseek-chat
SEARCH_API=duckduckgo   # 或 tavily
# TAVILY_API_KEY=...    # 使用 Tavily 时需要
```

**后端**：

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**前端**：

```bash
cd frontend
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)
