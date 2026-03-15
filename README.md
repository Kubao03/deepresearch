# A股深度研究助手

基于 LangGraph + FastAPI + Next.js 16 构建的 AI 投研 Agent，支持 A股/港股/美股，多工具协同搜索，Human-in-the-Loop 人工审核，SSE 实时进度推送。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 · TypeScript · Tailwind CSS |
| 后端 | FastAPI · Python |
| Agent | LangGraph StateGraph |
| LLM | OpenAI 兼容接口（DeepSeek / Qwen 等） |
| 搜索 | Tavily（langchain-tavily 直连） |
| 结构化数据 | AKShare MCP（mcp-aktools） |
| 记忆 | SQLite Checkpointer（断点续研） |

## 项目结构

```
stockresearch/
├── backend/
│   ├── main.py             # FastAPI 入口，统一日志配置
│   ├── config.py           # 环境配置
│   ├── prompts.py          # 所有 Agent 提示词（Planner / Sub-Agent / Reporter）
│   ├── utils.py            # 工具函数
│   ├── graph/
│   │   ├── state.py        # ResearchState 定义
│   │   ├── nodes.py        # planner / executor / reporter 节点
│   │   └── graph.py        # StateGraph 构建
│   ├── services/
│   │   ├── planner.py      # 任务规划（async ReAct Agent，含 search 工具）
│   │   ├── executor.py     # 子任务执行（ExecutionService）
│   │   └── reporter.py     # 报告生成
│   └── tools/
│       ├── __init__.py     # 对外入口：get_tools / start_mcp / stop_mcp
│       ├── akshare.py      # AKShare MCP 生命周期管理 + 白名单过滤
│       └── tavily.py       # Tavily 搜索工具配置
└── frontend/
    ├── app/
    │   ├── page.tsx        # 主页面（SSE 流 + Human Review UI）
    │   └── layout.tsx
    └── lib/
        └── api.ts          # streamResearch / resumeResearch
```

## Agent 流程

```
用户输入股票名称或代码
    → Planner（ReAct Agent）：
        若不认识该股票，自动调用 search 工具查询
        规划 5 个研究子任务（基本面/行业竞争/重大事件/技术面/机构资金）
    → interrupt()：暂停，前端展示 TODO 列表等待用户确认/修改
    → 用户确认后 /research/resume 恢复
    → Executor：逐任务运行 Sub-Agent（Tavily + AKShare），实时进度推送
    → Reporter：整合摘要生成投研报告
    → 前端渲染 Markdown 报告
```

## 已实现功能

- [x] LangGraph StateGraph 三节点架构（Planner → Executor → Reporter）
- [x] Human-in-the-Loop：`interrupt()` + SQLite Checkpointer 断点续研
- [x] SSE 实时流：`/research/stream` 启动，`/research/resume` 恢复
- [x] Planner 接入 AKShare search 工具，支持新上市股票解析
- [x] Executor Sub-Agent 工具白名单 + 调用次数约束，控制 token 消耗
- [x] Tavily 脱离 MCP，langchain-tavily 直连，参数可控
- [x] 全局当前日期注入，避免 LLM 时间感知偏差
- [x] 统一 stdlib logging，所有模块日志格式一致
- [x] Next.js 16 前端，暗色主题，响应式两栏布局
- [x] TODO 列表人工审核面板（可编辑/增删任务）
- [x] Markdown 报告渲染 + 一键复制

## 待实现

- [ ] 多线程执行子任务
- [ ] Docker Compose 一键部署

## 快速启动

**环境变量**（`backend/.env`）：

```env
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL_ID=deepseek-chat
TAVILY_API_KEY=your_tavily_key
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
