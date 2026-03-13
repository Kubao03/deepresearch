'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamResearch, resumeResearch, type TodoItem } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'streaming' | 'reviewing' | 'executing' | 'done' | 'error'

interface ProgressEvent {
  id: number
  type: 'info' | 'success' | 'warning' | 'step'
  message: string
  detail?: string
  timestamp: Date
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function LogoIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* Hexagon shape */}
      <path
        d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
        fill="url(#logo-grad)"
        opacity="0.15"
        stroke="url(#logo-grad)"
        strokeWidth="1.5"
      />
      {/* Chart bars */}
      <rect x="13" y="28" width="4" height="8" rx="1" fill="url(#logo-grad)" opacity="0.7" />
      <rect x="20" y="22" width="4" height="14" rx="1" fill="url(#logo-grad)" opacity="0.85" />
      <rect x="27" y="17" width="4" height="19" rx="1" fill="url(#logo-grad)" />
      {/* Trend line */}
      <polyline
        points="15,28 22,20 29,15 36,11"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.8"
      />
      <circle cx="36" cy="11" r="2" fill="#60a5fa" />
    </svg>
  )
}

function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TodoItem['status'] }) {
  const styles: Record<TodoItem['status'], string> = {
    pending: 'bg-gray-700/60 text-gray-300 border-gray-600/40',
    in_progress: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    skipped: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  }
  const labels: Record<TodoItem['status'], string> = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
    skipped: '已跳过',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

// ─── Progress Timeline ────────────────────────────────────────────────────────

interface StepDef {
  id: string
  label: string
  phases: Phase[]
  activePhases: Phase[]
  donePhases: Phase[]
}

const STEPS: StepDef[] = [
  {
    id: 'planner',
    label: '规划研究任务',
    phases: ['streaming', 'reviewing', 'executing', 'done'],
    activePhases: ['streaming'],
    donePhases: ['reviewing', 'executing', 'done'],
  },
  {
    id: 'review',
    label: '等待人工确认',
    phases: ['reviewing', 'executing', 'done'],
    activePhases: ['reviewing'],
    donePhases: ['executing', 'done'],
  },
  {
    id: 'executor',
    label: '执行研究任务',
    phases: ['executing', 'done'],
    activePhases: ['executing'],
    donePhases: ['done'],
  },
  {
    id: 'reporter',
    label: '生成研究报告',
    phases: ['done'],
    activePhases: [],
    donePhases: ['done'],
  },
]

function ProgressTimeline({
  phase,
  events,
}: {
  phase: Phase
  events: ProgressEvent[]
}) {
  const eventsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          研究进度
        </h3>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-4 bottom-4 w-px bg-white/8" />

          <div className="space-y-3">
            {STEPS.map((step) => {
              const isVisible = step.phases.includes(phase) || step.donePhases.includes(phase)
              const isActive = step.activePhases.includes(phase)
              const isDone = step.donePhases.includes(phase)

              if (!isVisible && phase !== 'error') {
                return (
                  <div key={step.id} className="flex items-center gap-3 pl-0.5 opacity-30">
                    <div className="w-6 h-6 rounded-full border border-white/10 bg-white/3 flex items-center justify-center flex-shrink-0 relative z-10" />
                    <span className="text-sm text-gray-600">{step.label}</span>
                  </div>
                )
              }

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 pl-0.5 transition-all duration-300 ${
                    isActive ? 'fade-in-up' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 transition-all duration-300 ${
                      isDone
                        ? 'bg-emerald-500/20 border border-emerald-500/50'
                        : isActive
                        ? 'bg-accent/20 border border-accent/50'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    {isDone ? (
                      <span className="text-emerald-400">
                        <CheckIcon size={12} />
                      </span>
                    ) : isActive ? (
                      <div className="pulse-dot" style={{ width: 6, height: 6 }} />
                    ) : null}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isDone
                        ? 'text-emerald-400'
                        : isActive
                        ? 'text-blue-300'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                    {isActive && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-400/70">
                        <SpinnerIcon size={10} />
                        处理中
                      </span>
                    )}
                  </span>
                </div>
              )
            })}

            {/* Error state */}
            {phase === 'error' && (
              <div className="flex items-center gap-3 pl-0.5">
                <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center flex-shrink-0 relative z-10">
                  <span className="text-red-400 text-xs font-bold">!</span>
                </div>
                <span className="text-sm text-red-400">发生错误</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event log */}
      {events.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            运行日志
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex gap-2 text-xs fade-in-up"
              >
                <span className="text-gray-600 flex-shrink-0 tabular-nums font-mono mt-0.5">
                  {ev.timestamp.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span
                  className={`flex-1 leading-relaxed ${
                    ev.type === 'success'
                      ? 'text-emerald-400'
                      : ev.type === 'warning'
                      ? 'text-amber-400'
                      : 'text-gray-300'
                  }`}
                >
                  {ev.message}
                  {ev.detail && (
                    <span className="block text-gray-500 mt-0.5">{ev.detail}</span>
                  )}
                </span>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TODO Review Panel ────────────────────────────────────────────────────────

function TodoReviewPanel({
  todoList,
  onConfirm,
  onCancel,
  loading,
}: {
  todoList: TodoItem[]
  onConfirm: (items: TodoItem[]) => void
  onCancel: () => void
  loading: boolean
}) {
  const [items, setItems] = useState<TodoItem[]>(todoList)

  const updateItem = useCallback(
    (id: number, updates: Partial<TodoItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      )
    },
    []
  )

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const addItem = useCallback(() => {
    const newId = Math.max(0, ...items.map((i) => i.id)) + 1
    setItems((prev) => [
      ...prev,
      {
        id: newId,
        title: '新研究任务',
        intent: '请描述研究意图',
        query: '请输入搜索关键词',
        status: 'pending',
      },
    ])
  }, [items])

  const toggleSkip = useCallback((id: number, current: TodoItem['status']) => {
    updateItem(id, {
      status: current === 'skipped' ? 'pending' : 'skipped',
    })
  }, [updateItem])

  return (
    <div className="glass-card p-5 fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">研究计划</h2>
          <p className="text-xs text-gray-500 mt-0.5">请确认或修改以下研究任务，然后开始执行</p>
        </div>
        <span className="text-xs text-gray-400 tabular-nums">
          {items.length} 项
        </span>
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`rounded-lg border p-3.5 transition-all duration-200 ${
              item.status === 'skipped'
                ? 'border-white/5 bg-white/2 opacity-50'
                : 'border-white/8 bg-white/3 hover:border-white/12'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Index */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mt-0.5">
                <span className="text-xs font-bold text-blue-400">{idx + 1}</span>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                {/* Title */}
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  disabled={item.status === 'skipped'}
                  className="w-full bg-transparent text-sm font-medium text-white placeholder-gray-600 focus:outline-none border-b border-transparent focus:border-white/20 pb-0.5 transition-colors"
                  placeholder="任务标题"
                />

                {/* Intent */}
                <p className="text-xs text-gray-500 leading-relaxed">{item.intent}</p>

                {/* Query */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 flex-shrink-0">搜索词:</span>
                  <input
                    type="text"
                    value={item.query}
                    onChange={(e) => updateItem(item.id, { query: e.target.value })}
                    disabled={item.status === 'skipped'}
                    className="flex-1 min-w-0 bg-black/20 border border-white/8 rounded px-2 py-1 text-xs text-gray-300 font-mono focus:outline-none focus:border-blue-500/40 transition-colors"
                    placeholder="搜索关键词"
                  />
                </div>

                {/* Status badge */}
                <StatusBadge status={item.status} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleSkip(item.id, item.status)}
                  title={item.status === 'skipped' ? '恢复任务' : '跳过任务'}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    item.status === 'skipped'
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-gray-500 hover:bg-white/8 hover:text-gray-300'
                  }`}
                >
                  {item.status === 'skipped' ? '↩' : '⊘'}
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  title="删除任务"
                  className="p-1.5 rounded text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add task */}
      <button
        onClick={addItem}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/15 text-sm text-gray-500 hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/5 transition-all duration-200"
      >
        <PlusIcon />
        添加研究任务
      </button>

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-300 transition-all duration-200 disabled:opacity-50"
        >
          取消
        </button>
        <button
          onClick={() => onConfirm(items)}
          disabled={loading}
          className="flex-[2] py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-semibold text-white hover:from-blue-500 hover:to-blue-400 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
        >
          {loading ? (
            <>
              <SpinnerIcon size={14} />
              提交中...
            </>
          ) : (
            <>
              <CheckIcon size={14} />
              确认并开始研究
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Report Panel ─────────────────────────────────────────────────────────────

function ReportPanel({ report }: { report: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [report])

  return (
    <div className="glass-card flex flex-col h-full fade-in-up" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <h2 className="text-sm font-semibold text-white">研究报告</h2>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            copied
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-white/5 text-gray-400 border border-white/8 hover:bg-white/10 hover:text-gray-200'
          }`}
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon />}
          {copied ? '已复制' : '复制报告'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5" style={{ minHeight: 0 }}>
        <div className="report-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

// ─── Report Loading Placeholder ───────────────────────────────────────────────

function ReportPlaceholder({ phase }: { phase: Phase }) {
  const messages: Partial<Record<Phase, string>> = {
    streaming: '正在规划研究方向...',
    reviewing: '等待确认研究计划...',
    executing: '正在执行研究任务，请稍候...',
  }
  return (
    <div className="glass-card h-full flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
          {phase === 'executing' ? (
            <SpinnerIcon size={28} />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-blue-400">
              <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-300">
            {messages[phase] ?? '准备生成报告...'}
          </p>
          <p className="text-xs text-gray-600 mt-1">报告将在研究完成后显示</p>
        </div>
        {(phase === 'executing' || phase === 'streaming') && (
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-500/50"
                style={{
                  animation: `pulse-slow 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Idle Form ────────────────────────────────────────────────────────────────

function IdleForm({
  topic,
  searchApi,
  loading,
  onTopicChange,
  onSearchApiChange,
  onSubmit,
}: {
  topic: string
  searchApi: string
  loading: boolean
  onTopicChange: (v: string) => void
  onSearchApiChange: (v: string) => void
  onSubmit: () => void
}) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo & title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/15 shadow-lg shadow-blue-500/10">
              <LogoIcon />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              A股深度研究助手
            </h1>
            <p className="mt-2 text-gray-400 text-sm leading-relaxed">
              输入研究主题，AI 将自动规划任务、搜集资料并生成专业投研报告
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="glass-card p-6 space-y-5 shadow-2xl shadow-black/40">
          {/* Topic textarea */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              研究主题
            </label>
            <textarea
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder="例如：分析贵州茅台 600519 的投资价值"
              rows={3}
              className="w-full bg-black/20 border border-white/8 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 resize-none leading-relaxed"
            />
            <p className="text-xs text-gray-600">提示：可以包含股票代码、行业名称或具体分析问题</p>
          </div>

          {/* Search API select */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
              搜索引擎
            </label>
            <div className="relative">
              <select
                value={searchApi}
                onChange={(e) => onSearchApiChange(e.target.value)}
                className="w-full bg-black/20 border border-white/8 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 transition-all duration-200 appearance-none cursor-pointer"
              >
                <option value="">默认 (DuckDuckGo)</option>
                <option value="tavily">Tavily (高质量)</option>
                <option value="duckduckgo">DuckDuckGo</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={onSubmit}
            disabled={!topic.trim() || loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 text-sm font-semibold text-white hover:from-blue-500 hover:via-blue-400 hover:to-indigo-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35"
          >
            {loading ? (
              <>
                <SpinnerIcon size={14} />
                正在启动...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 3l14 9-14 9V3z" fill="currentColor" />
                </svg>
                开始研究
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-600">
            按 <kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-gray-500 text-xs font-mono">⌘ Enter</kbd> 快速提交
          </p>
        </div>

        {/* Feature tags */}
        <div className="flex flex-wrap justify-center gap-2">
          {['自动规划', '多轮搜索', '人工审核', 'Markdown报告'].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full text-xs text-gray-500 bg-white/4 border border-white/6"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [topic, setTopic] = useState('')
  const [searchApi, setSearchApi] = useState('')
  const [threadId, setThreadId] = useState('')
  const [todoList, setTodoList] = useState<TodoItem[]>([])
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([])
  const [finalReport, setFinalReport] = useState('')
  const [error, setError] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)

  const eventIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const addEvent = useCallback(
    (
      message: string,
      type: ProgressEvent['type'] = 'info',
      detail?: string
    ) => {
      setProgressEvents((prev) => [
        ...prev,
        {
          id: ++eventIdRef.current,
          type,
          message,
          detail,
          timestamp: new Date(),
        },
      ])
    },
    []
  )

  const handleSSEEvent = useCallback(
    (event: unknown, _currentPhase: Phase, onPhaseChange: (p: Phase) => void) => {
      const ev = event as Record<string, unknown>

      // Thread ID event
      if (ev.type === 'thread_id' && typeof ev.thread_id === 'string') {
        setThreadId(ev.thread_id)
        addEvent(`会话 ID: ${ev.thread_id.slice(0, 8)}...`, 'info')
        return
      }

      // Error event
      if (ev.type === 'error') {
        const detail = typeof ev.detail === 'string' ? ev.detail : '未知错误'
        setError(detail)
        onPhaseChange('error')
        addEvent(`错误: ${detail}`, 'warning')
        return
      }

      // Interrupt event — human review needed
      if (ev.__interrupt__ && Array.isArray(ev.__interrupt__)) {
        const interrupts = ev.__interrupt__ as Array<{
          value?: { type?: string; todo_list?: TodoItem[] }
        }>
        for (const interrupt of interrupts) {
          if (
            interrupt.value?.type === 'todo_review' &&
            Array.isArray(interrupt.value.todo_list)
          ) {
            setTodoList(interrupt.value.todo_list)
            onPhaseChange('reviewing')
            addEvent(
              `规划完成，共 ${interrupt.value.todo_list.length} 个研究任务，等待确认`,
              'success'
            )
            return
          }
        }
      }

      // LangGraph node update events
      if (ev.planner !== undefined) {
        addEvent('Planner 已完成任务规划', 'success')
      }

      if (ev.executor !== undefined) {
        addEvent('所有研究任务已执行完毕', 'success')
      }

      // Custom streaming events from within executor_node
      if (ev.type === 'task_start') {
        const { task_title, current, total } = ev as { task_title: string; current: number; total: number }
        addEvent(`[${current}/${total}] 正在执行：${task_title}`, 'info')
      }

      if (ev.type === 'task_done') {
        const { task_title, current, total } = ev as { task_title: string; current: number; total: number }
        addEvent(`[${current}/${total}] 完成：${task_title}`, 'success')
      }

      if (ev.reporter !== undefined) {
        addEvent('Reporter 正在生成报告...', 'info')
        const reporterData = ev.reporter as Record<string, unknown>
        if (typeof reporterData.final_report === 'string') {
          setFinalReport(reporterData.final_report)
          onPhaseChange('done')
          addEvent('研究报告已生成', 'success')
        }
      }
    },
    [addEvent]
  )

  const handleStart = useCallback(async () => {
    if (!topic.trim()) return

    // Reset state
    setPhase('streaming')
    setProgressEvents([])
    setFinalReport('')
    setError('')
    setThreadId('')
    setTodoList([])

    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    addEvent('正在启动研究流程...', 'info')

    let currentPhase: Phase = 'streaming'
    const onPhaseChange = (p: Phase) => {
      currentPhase = p
      setPhase(p)
    }

    try {
      await streamResearch(
        {
          topic: topic.trim(),
          search_api: searchApi || undefined,
        },
        (event) => handleSSEEvent(event, currentPhase, onPhaseChange),
        abort.signal
      )

      // Stream ended naturally
      if (currentPhase === 'streaming') {
        // Still streaming but stream ended without interrupt — something may be off
        addEvent('数据流已结束', 'info')
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : '未知错误'
      setError(msg)
      setPhase('error')
      addEvent(`连接失败: ${msg}`, 'warning')
    }
  }, [topic, searchApi, addEvent, handleSSEEvent])

  const handleResume = useCallback(
    async (reviewedItems: TodoItem[]) => {
      if (!threadId) return
      setResumeLoading(true)
      setPhase('executing')
      addEvent('提交确认，开始执行研究任务...', 'info')

      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort

      let currentPhase: Phase = 'executing'
      const onPhaseChange = (p: Phase) => {
        currentPhase = p
        setPhase(p)
      }

      try {
        await resumeResearch(
          { thread_id: threadId, reviewed_todo_list: reviewedItems },
          (event) => handleSSEEvent(event, currentPhase, onPhaseChange),
          abort.signal
        )

        // Stream ended — if we haven't transitioned to done, mark it
        if (currentPhase === 'executing') {
          addEvent('执行完成', 'success')
          setPhase('done')
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        const msg = err instanceof Error ? err.message : '未知错误'
        setError(msg)
        setPhase('error')
        addEvent(`执行失败: ${msg}`, 'warning')
      } finally {
        setResumeLoading(false)
      }
    },
    [threadId, addEvent, handleSSEEvent]
  )

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setPhase('idle')
    setProgressEvents([])
    setFinalReport('')
    setError('')
    setThreadId('')
    setTodoList([])
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // ── Idle UI ──────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <IdleForm
        topic={topic}
        searchApi={searchApi}
        loading={false}
        onTopicChange={setTopic}
        onSearchApiChange={setSearchApi}
        onSubmit={handleStart}
      />
    )
  }

  // ── Active UI (two-column layout) ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b border-white/6 bg-black/20 backdrop-blur-sm px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoIcon />
            <div>
              <h1 className="text-sm font-semibold text-white">A股深度研究助手</h1>
              <p className="text-xs text-gray-500 truncate max-w-sm">{topic}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Phase badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                phase === 'done'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : phase === 'error'
                  ? 'bg-red-500/10 text-red-400 border-red-500/25'
                  : phase === 'reviewing'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/25'
              }`}
            >
              {phase !== 'done' && phase !== 'error' && (
                <div className="pulse-dot" style={{ width: 5, height: 5 }} />
              )}
              {phase === 'streaming' && '规划中'}
              {phase === 'reviewing' && '等待确认'}
              {phase === 'executing' && '执行中'}
              {phase === 'done' && '✓ 完成'}
              {phase === 'error' && '✗ 错误'}
            </div>

            {/* New research button */}
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-all duration-200"
            >
              新建研究
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full flex gap-5 p-5">
          {/* Left panel */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
            {/* Progress timeline */}
            <ProgressTimeline phase={phase} events={progressEvents} />

            {/* Error message */}
            {phase === 'error' && error && (
              <div className="glass-card p-4 border-red-500/25 fade-in-up">
                <p className="text-sm text-red-400 font-medium mb-1">发生错误</p>
                <p className="text-xs text-red-300/70 leading-relaxed">{error}</p>
                <button
                  onClick={handleCancel}
                  className="mt-3 w-full py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/15 transition-colors"
                >
                  返回重试
                </button>
              </div>
            )}

            {/* TODO Review Panel */}
            {phase === 'reviewing' && (
              <TodoReviewPanel
                todoList={todoList}
                onConfirm={handleResume}
                onCancel={handleCancel}
                loading={resumeLoading}
              />
            )}
          </div>

          {/* Right panel — report */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
            {finalReport ? (
              <ReportPanel report={finalReport} />
            ) : (
              <ReportPlaceholder phase={phase} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
