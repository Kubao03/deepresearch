'use client'

import { useRef, useEffect } from 'react'
import type { Phase, ProgressEvent } from '@/lib/types'
import type { TodoItem } from '@/lib/types'
import { CheckIcon, SpinnerIcon } from './icons'

export function StatusBadge({ status }: { status: TodoItem['status'] }) {
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
    phases: ['streaming', 'reviewing', 'executing', 'review_results', 'reporting', 'done'],
    activePhases: ['streaming'],
    donePhases: ['reviewing', 'executing', 'review_results', 'reporting', 'done'],
  },
  {
    id: 'review',
    label: '确认研究计划',
    phases: ['reviewing', 'executing', 'review_results', 'reporting', 'done'],
    activePhases: ['reviewing'],
    donePhases: ['executing', 'review_results', 'reporting', 'done'],
  },
  {
    id: 'executor',
    label: '并行执行任务',
    phases: ['executing', 'review_results', 'reporting', 'done'],
    activePhases: ['executing'],
    donePhases: ['review_results', 'reporting', 'done'],
  },
  {
    id: 'review_results',
    label: '确认研究结果',
    phases: ['review_results', 'reporting', 'done'],
    activePhases: ['review_results'],
    donePhases: ['reporting', 'done'],
  },
  {
    id: 'reporter',
    label: '生成研究报告',
    phases: ['reporting', 'done'],
    activePhases: ['reporting'],
    donePhases: ['done'],
  },
]

export function ProgressTimeline({ phase, events }: { phase: Phase; events: ProgressEvent[] }) {
  const eventsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">研究进度</h3>
        <div className="relative">
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
                <div key={step.id} className={`flex items-center gap-3 pl-0.5 transition-all duration-300 ${isActive ? 'fade-in-up' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 transition-all duration-300 ${
                    isDone ? 'bg-emerald-500/20 border border-emerald-500/50'
                    : isActive ? 'bg-accent/20 border border-accent/50'
                    : 'bg-white/5 border border-white/10'
                  }`}>
                    {isDone ? (
                      <span className="text-emerald-400"><CheckIcon size={12} /></span>
                    ) : isActive ? (
                      <div className="pulse-dot" style={{ width: 6, height: 6 }} />
                    ) : null}
                  </div>
                  <span className={`text-sm font-medium ${isDone ? 'text-emerald-400' : isActive ? 'text-blue-300' : 'text-gray-500'}`}>
                    {step.label}
                    {isActive && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-400/70">
                        <SpinnerIcon size={10} />处理中
                      </span>
                    )}
                  </span>
                </div>
              )
            })}

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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">运行日志</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {events.map((ev) => (
              <div key={ev.id} className="flex gap-2 text-xs fade-in-up">
                <span className="text-gray-600 flex-shrink-0 tabular-nums font-mono mt-0.5">
                  {ev.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`flex-1 leading-relaxed ${
                  ev.type === 'success' ? 'text-emerald-400'
                  : ev.type === 'warning' ? 'text-amber-400'
                  : 'text-gray-300'
                }`}>
                  {ev.message}
                  {ev.detail && <span className="block text-gray-500 mt-0.5">{ev.detail}</span>}
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
