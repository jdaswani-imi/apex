import Anthropic from '@anthropic-ai/sdk'
import { getTodayContext, getFullUserContext } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { createClient } from '@/lib/supabase/server'
import { getCachedAI, setCachedAI } from '@/lib/ai-cache'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const anthropic = new Anthropic()

const PAGE_FOCUS: Record<string, string> = {
  food: 'Focus only on nutrition. Look at protein and calorie intake vs targets, meal timing, and what is still needed today. Give 1-2 sentences of specific, actionable advice.',
  today: 'Give one key insight for right now — the single most important thing to act on today based on recovery, sleep, nutrition, and training data. 1-2 sentences.',
  training: 'Focus on today\'s training session. Consider recovery score, scheduled session type, and recent performance. Give 1-2 sentences of specific advice.',
  sleep: 'Focus on last night\'s sleep data and patterns. Give 1-2 sentences of specific, actionable advice to improve sleep.',
  supplements: 'Focus on supplement adherence and timing. Give 1-2 sentences of specific, actionable advice.',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!await checkRateLimit(`rl:ai-tip:${user.id}`, 30, 3600_000)) return rateLimitResponse()

  const { page } = await request.json()

  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `ai:tip:${user.id}:${page ?? 'today'}:${today}`
  const cached = await getCachedAI<{ tip: string }>(cacheKey)
  if (cached) return Response.json(cached, { headers: { 'Cache-Control': 'private, max-age=1800' } })

  const [ctx, userCtx] = await Promise.all([
    getTodayContext(),
    getFullUserContext(),
  ])

  if (!ctx) {
    return new Response('Unauthorized', { status: 401 })
  }

  const systemPrompt = buildSystemPrompt(ctx, userCtx)
  const focus = PAGE_FOCUS[page as string] ?? 'Give the single most important insight from today\'s data in 1-2 sentences.'

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `${focus} Be direct. No greeting, no sign-off. Just the insight.`,
      },
    ],
  })

  const tip = response.content[0].type === 'text' ? response.content[0].text : ''
  const result = { tip }

  await setCachedAI(cacheKey, result, 1800)
  return Response.json(result, {
    headers: { 'Cache-Control': 'private, max-age=1800' },
  })
}
