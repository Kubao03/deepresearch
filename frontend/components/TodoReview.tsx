'use client'

import { useState, useCallback, useEffect } from 'react'
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

  // --- 新增：自动调整高度的逻辑 ---
  const adjustAllHeights = () => {
    // 找到当前面板下所有的 textarea
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((el) => {
      const target = el as HTMLTextAreaElement;
      target.style.height = 'auto';
      target.style.height = `${target.scrollHeight}px`;
    });
  };

  // 1. 初始化和列表增删时触发
  useEffect(() => {
    adjustAllHeights();
  }, [items]);
  // ----------------------------

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
      { 
        id: newId, 
        title: '新研究任务', 
        intent: '请输入研究意图', 
        status: 'pending',
        summary: null,
        sources: null 
      },
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
            <div className="flex items-start gap-1">
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
                
                <div className="flex items-start gap-3">
                  <span className="text-xs text-gray-600 flex-shrink-0 mt-1">意图:</span>
                  <textarea
                    value={item.intent}
                    onChange={(e) => updateItem(item.id, { intent: e.target.value })}
                    disabled={item.status === 'skipped'}
                    rows={1}
                    className="w-full bg-transparent text-xs text-gray-500 leading-relaxed focus:outline-none focus:text-gray-300 transition-colors resize-none overflow-hidden"
                    placeholder="任务研究意图"
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                </div>
                
                <StatusBadge status={item.status} />
              </div>

              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => toggleSkip(item.id, item.status)}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    item.status === 'skipped'
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-gray-500 hover:bg-white/8 hover:text-gray-300'
                  }`}
                >
                  {item.status === 'skipped' ? '恢复' : '跳过'}
                </button>
                <button
                  onClick={() => removeItem(item.id)}
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
        <span className="w-3.5 h-3.5"><PlusIcon /></span>
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
            <><span className="w-3.5 h-3.5 animate-spin"><SpinnerIcon /></span>提交中...</>
          ) : (
            <><span className="w-3.5 h-3.5"><CheckIcon /></span>确认并开始研究</>
          )}
        </button>
      </div>
    </div>
  )
}