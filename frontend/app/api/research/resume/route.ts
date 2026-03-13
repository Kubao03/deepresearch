const BACKEND = 'http://localhost:8000'

export async function POST(request: Request) {
  const body = await request.json()

  const upstream = await fetch(`${BACKEND}/research/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
