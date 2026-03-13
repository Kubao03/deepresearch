'use client'

import { useState, useCallback } from 'react'
import type { TodoItem } from '@/lib/types'
import { StatusBadge } from './ProgressTimeline'
import { CheckIcon, SpinnerIcon, PlusIcon, TrashIcon } from './icons'

export function TodoReviewPanel({
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

  const updateItem = useCallback((id: number, updates: Partial<TodoItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }, [])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const addItem = useCallback(() => {
    const newId = Math.max(0, ...items.map((i) => i.id)) + 1
    setItems((prev) => [
      ...prev,
      { id: newId, title: '新研究任务', intent: '请描述研究意图', query: '请输入搜索关键词', status: 'pending' },
    ])
  }, [items])

  const toggleSkip = useCallback(
    (id: number, current: TodoItem['status']) => {
      updateItem(id, { status: current === 'skipped' ? 'pending' : 'skipped' })
    },
    [updateItem]
  )

  return (
    <div className="glass-card p-5 fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">研究计划</h2>
          <p className="text-xs text-gray-500 mt-0.5">请确认或修改以下研究任务，然后开始执行</p>
        </div>
        <span className="text-xs text-gray-400 tabular-nums">{items.length} 项</span>
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
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mt-0.5">
                <span className="text-xs font-bold text-blue-400">{idx + 1}</span>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  disabled={item.status === 'skipped'}
                  className="w-full bg-transparent text-sm font-medium text-white placeholder-gray-600 focus:outline-none border-b border-transparent focus:border-white/20 pb-0.5 transition-colors"
                  placeholder="任务标题"
                />
                <p className="text-xs text-gray-500 leading-relaxed">{item.intent}</p>
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
                <StatusBadge status={item.status} />
              </div>

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

      <button
        onClick={addItem}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/15 text-sm text-gray-500 hover:border-blue-500/30 hover:text-blue-400 hover:bg-blue-500/5 transition-all duration-200"
      >
        <PlusIcon />
        添加研究任务
      </button>

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
            <><SpinnerIcon size={14} />提交中...</>
          ) : (
            <><CheckIcon size={14} />确认并开始研究</>
          )}
        </button>
      </div>
    </div>
  )
}
