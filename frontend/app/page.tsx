'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Phase, ProgressEvent, TodoItem } from '@/lib/types'
import { streamResearch, resumeResearch } from '@/lib/api'
import { LogoIcon, SpinnerIcon } from '@/components/icons'
import { ProgressTimeline } from '@/components/ProgressTimeline'
import { TodoReviewPanel } from '@/components/TodoReview'
import { ReportPanel, ReportPlaceholder } from '@/components/ReportPanel'
import { IdleForm } from '@/components/IdleForm'

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

  const addEvent = useCallback((message: string, type: ProgressEvent['type'] = 'info', detail?: string) => {
    setProgressEvents((prev) => [
      ...prev,
      { id: ++eventIdRef.current, type, message, detail, timestamp: new Date() },
    ])
  }, [])

  const handleSSEEvent = useCallback(
    (event: unknown, _currentPhase: Phase, onPhaseChange: (p: Phase) => void) => {
      const ev = event as Record<string, unknown>

      if (ev.type === 'thread_id' && typeof ev.thread_id === 'string') {
        setThreadId(ev.thread_id)
        addEvent(`会话 ID: ${ev.thread_id.slice(0, 8)}...`, 'info')
        return
      }

      if (ev.type === 'error') {
        const detail = typeof ev.detail === 'string' ? ev.detail : '未知错误'
        setError(detail)
        onPhaseChange('error')
        addEvent(`错误: ${detail}`, 'warning')
        return
      }

      if (ev.__interrupt__ && Array.isArray(ev.__interrupt__)) {
        const interrupts = ev.__interrupt__ as Array<{ value?: { type?: string; todo_list?: TodoItem[] } }>
        for (const interrupt of interrupts) {
          if (interrupt.value?.type === 'todo_review' && Array.isArray(interrupt.value.todo_list)) {
            setTodoList(interrupt.value.todo_list)
            onPhaseChange('reviewing')
            addEvent(`规划完成，共 ${interrupt.value.todo_list.length} 个研究任务，等待确认`, 'success')
            return
          }
        }
      }

      if (ev.planner !== undefined) addEvent('Planner 已完成任务规划', 'success')
      if (ev.executor !== undefined) addEvent('所有研究任务已执行完毕', 'success')

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
    const onPhaseChange = (p: Phase) => { currentPhase = p; setPhase(p) }

    try {
      await streamResearch(
        { topic: topic.trim(), search_api: searchApi || undefined },
        (event) => handleSSEEvent(event, currentPhase, onPhaseChange),
        abort.signal
      )
      if (currentPhase === 'streaming') addEvent('数据流已结束', 'info')
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
      const onPhaseChange = (p: Phase) => { currentPhase = p; setPhase(p) }

      try {
        await resumeResearch(
          { thread_id: threadId, reviewed_todo_list: reviewedItems },
          (event) => handleSSEEvent(event, currentPhase, onPhaseChange),
          abort.signal
        )
        if (currentPhase === 'executing') { addEvent('执行完成', 'success'); setPhase('done') }
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

  useEffect(() => () => { abortRef.current?.abort() }, [])

  if (phase === 'idle') {
    return (
      <IdleForm
        topic={topic}
        loading={false}
        onTopicChange={setTopic}
        onSubmit={handleStart}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
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
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              phase === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : phase === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/25'
              : phase === 'reviewing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              : 'bg-blue-500/10 text-blue-400 border-blue-500/25'
            }`}>
              {phase !== 'done' && phase !== 'error' && <div className="pulse-dot" style={{ width: 5, height: 5 }} />}
              {phase === 'streaming' && '规划中'}
              {phase === 'reviewing' && '等待确认'}
              {phase === 'executing' && <><SpinnerIcon size={10} />执行中</>}
              {phase === 'done' && '✓ 完成'}
              {phase === 'error' && '✗ 错误'}
            </div>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:bg-white/8 hover:text-gray-200 transition-all duration-200"
            >
              新建研究
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex min-h-0 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full flex gap-5 p-5">
          {/* Left panel */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
            <ProgressTimeline phase={phase} events={progressEvents} />

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

            {phase === 'reviewing' && (
              <TodoReviewPanel
                todoList={todoList}
                onConfirm={handleResume}
                onCancel={handleCancel}
                loading={resumeLoading}
              />
            )}
          </div>

          {/* Right panel */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
            {finalReport ? <ReportPanel report={finalReport} /> : <ReportPlaceholder phase={phase} />}
          </div>
        </div>
      </main>
    </div>
  )
}
