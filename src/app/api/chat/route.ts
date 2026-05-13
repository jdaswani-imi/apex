import Anthropic from '@anthropic-ai/sdk'
import { getTodayContext, getFullUserContext } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const { messages } = await request.json()

  const [ctx, userCtx] = await Promise.all([
    getTodayContext(),
    getFullUserContext(),
  ])

  if (!ctx) {
    return new Response('Unauthorized', { status: 401 })
  }

  const systemPrompt = buildSystemPrompt(ctx, userCtx)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const response = await anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      })

      for await (const chunk of response) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
