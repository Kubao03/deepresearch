import type { TodoItem } from './types'
export type { TodoItem }

async function parseSSEStream(
  response: Response,
  onEvent: (event: unknown) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on double newlines (SSE message boundaries)
      const parts = buffer.split('\n\n')
      // Keep the last potentially incomplete part in buffer
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const lines = part.split('\n')
        let data = ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            data += line.slice(6)
          }
        }

        if (data.trim()) {
          try {
            const parsed = JSON.parse(data.trim())
            onEvent(parsed)
          } catch {
            // Non-JSON data line, skip
          }
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      const lines = buffer.split('\n')
      let data = ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          data += line.slice(6)
        }
      }
      if (data.trim()) {
        try {
          const parsed = JSON.parse(data.trim())
          onEvent(parsed)
        } catch {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function streamResearch(
  payload: { topic: string; search_api?: string },
  onEvent: (event: unknown) => void,
  signal?: AbortSignal
): Promise<void> {
  const body: Record<string, string> = { topic: payload.topic }
  if (payload.search_api) {
    body.search_api = payload.search_api
  }

  const base = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000'
  const response = await fetch(`${base}/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  await parseSSEStream(response, onEvent, signal)
}

export async function resumeResearch(
  payload: { thread_id: string; reviewed_todo_list: TodoItem[] | null },
  onEvent: (event: unknown) => void,
  signal?: AbortSignal
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000'
  const response = await fetch(`${base}/research/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  await parseSSEStream(response, onEvent, signal)
}
