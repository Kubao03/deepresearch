'use client'

import type { TaskState, Source } from '@/lib/types'
import { SpinnerIcon, CheckIcon } from './icons'

function SourceItem({ source }: { source: Source }) {
  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-400/80 hover:text-blue-300 transition-colors min-w-0"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="truncate">{source.title || source.url}</span>
      </a>
    )
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="truncate">{source.interface ?? source.desc ?? '结构化数据'}</span>
    </div>
  )
}

function TaskCard({ task, index }: { task: TaskState; index: number }) {
  const isCompleted = task.status === 'completed'
  const isInProgress = task.status === 'in_progress'

  return (
    <div
      className={`glass-card p-4 flex flex-col gap-3 transition-all duration-500 ${
        isInProgress
          ? 'border-blue-500/35 shadow-lg shadow-blue-500/8'
          : isCompleted
          ? 'border-emerald-500/25'
          : 'opacity-50'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-300 ${
              isCompleted
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : isInProgress
                ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                : 'bg-white/5 border border-white/10 text-gray-600'
            }`}
          >
            {isCompleted ? <CheckIcon size={10} /> : index + 1}
          </div>
          <h4
            className={`text-xs font-semibold leading-tight ${
              isCompleted ? 'text-white' : isInProgress ? 'text-blue-200' : 'text-gray-500'
            }`}
          >
            {task.title}
          </h4>
        </div>
        <div className="flex-shrink-0">
          {isInProgress && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <SpinnerIcon size={10} />
              执行中
            </span>
          )}
          {isCompleted && <span className="text-xs text-emerald-400">完成</span>}
          {task.status === 'pending' && <span className="text-xs text-gray-600">待执行</span>}
        </div>
      </div>

      {/* Body — 可滚动 */}
      <div className="overflow-y-auto max-h-48 pr-1 space-y-2.5">
        {isInProgress && (
          <div className="space-y-2 pt-1">
            {[75, 95, 60, 80, 50].map((w, i) => (
              <div
                key={i}
                className="h-2 rounded-sm bg-blue-500/8 animate-pulse"
                style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}

        {task.status === 'pending' && (
          <p className="text-xs text-gray-700 py-2">等待执行...</p>
        )}

        {isCompleted && task.summary && (
          <p className="text-xs text-gray-400 leading-relaxed fade-in-up">
            {task.summary}
          </p>
        )}

        {isCompleted && task.sources && task.sources.length > 0 && (
          <div className="border-t border-white/6 pt-2.5 space-y-1.5">
            <p className="text-xs text-gray-600 mb-1.5">数据来源</p>
            {task.sources.map((src, i) => (
              <SourceItem key={i} source={src} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function TaskCardsPanel({ tasks }: { tasks: TaskState[] }) {
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const total = tasks.length

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto pb-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">并行研究任务</h2>
          <p className="text-xs text-gray-500 mt-0.5">{total} 个任务同时执行中</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-24 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500/60 rounded-full transition-all duration-700"
              style={{ width: `${total > 0 ? (completedCount / total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 tabular-nums">{completedCount}/{total}</span>
        </div>
      </div>

      {/* 单列列表 */}
      <div className="flex flex-col gap-3">
        {tasks.map((task, i) => (
          <TaskCard key={task.id} task={task} index={i} />
        ))}
      </div>
    </div>
  )
}
