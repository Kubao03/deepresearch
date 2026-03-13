import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'A股深度研究助手',
  description: '基于 AI 的 A 股深度研究助手，自动规划研究任务、执行搜索并生成专业投研报告',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen`}
        style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}
      >
        {/* Aurora background decorators */}
        <div className="aurora" aria-hidden="true">
          <div className="aurora-orb aurora-orb-1" />
          <div className="aurora-orb aurora-orb-2" />
          <div className="aurora-orb aurora-orb-3" />
        </div>

        {/* Main content */}
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
