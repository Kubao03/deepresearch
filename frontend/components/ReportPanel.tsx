'use client'

import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Phase } from '@/lib/types'
import { CheckIcon, CopyIcon, SpinnerIcon } from './icons'

export function ReportPanel({ report }: { report: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [report])

  return (
    <div className="glass-card flex flex-col h-full fade-in-up" style={{ minHeight: 0 }}>
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
      <div className="flex-1 overflow-y-auto p-5" style={{ minHeight: 0 }}>
        <div className="report-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

export function ReportPlaceholder({ phase }: { phase: Phase }) {
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
          <p className="text-sm font-medium text-gray-300">{messages[phase] ?? '准备生成报告...'}</p>
          <p className="text-xs text-gray-600 mt-1">报告将在研究完成后显示</p>
        </div>
        {(phase === 'executing' || phase === 'streaming') && (
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-500/50"
                style={{ animation: `pulse-slow 1.4s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
