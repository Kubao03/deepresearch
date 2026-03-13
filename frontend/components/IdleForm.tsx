'use client'

import { LogoIcon, SpinnerIcon } from './icons'

export function IdleForm({
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
            <h1 className="text-3xl font-bold tracking-tight text-white">A股深度研究助手</h1>
            <p className="mt-2 text-gray-400 text-sm leading-relaxed">
              输入研究主题，AI 将自动规划任务、搜集资料并生成专业投研报告
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="glass-card p-6 space-y-5 shadow-2xl shadow-black/40">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">研究主题</label>
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

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">搜索引擎</label>
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

          <button
            onClick={onSubmit}
            disabled={!topic.trim() || loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 text-sm font-semibold text-white hover:from-blue-500 hover:via-blue-400 hover:to-indigo-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35"
          >
            {loading ? (
              <><SpinnerIcon size={14} />正在启动...</>
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
            按{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-gray-500 text-xs font-mono">
              ⌘ Enter
            </kbd>{' '}
            快速提交
          </p>
        </div>

        {/* Feature tags */}
        <div className="flex flex-wrap justify-center gap-2">
          {['自动规划', '多轮搜索', '人工审核', 'Markdown报告'].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs text-gray-500 bg-white/4 border border-white/6">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
