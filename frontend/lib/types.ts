export type Phase = 'idle' | 'streaming' | 'reviewing' | 'executing' | 'done' | 'error'

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
  summary?: string | null;
  // 对应后端的 Optional[List[dict]]
  sources?: Source[] | null; 
}