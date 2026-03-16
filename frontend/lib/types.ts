export type Phase = 'idle' | 'streaming' | 'reviewing' | 'executing' | 'review_results' | 'reporting' | 'done' | 'error'

export interface ProgressEvent {
  id: number
  type: 'info' | 'success' | 'warning' | 'step'
  message: string
  detail?: string
  timestamp: Date
}

export interface Source {
  type: 'web' | 'akshare' | string;
  title?: string;
  url?: string;
  interface?: string; // 针对 akshare
  desc?: string;      // 针对 akshare
}

export interface CompanyInfo {
  ticker: string
  company: string
  market: string
}

export interface TodoItem {
  id: number;
  title: string;
  intent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface TaskState {
  id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  summary?: string;
  sources?: Source[];
}