export type Phase = 'idle' | 'streaming' | 'reviewing' | 'executing' | 'done' | 'error'

export interface ProgressEvent {
  id: number
  type: 'info' | 'success' | 'warning' | 'step'
  message: string
  detail?: string
  timestamp: Date
}

export interface TodoItem {
  id: number
  title: string
  intent: string
  query: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  summary?: string
  sources_summary?: string
  source_type?: string
}
