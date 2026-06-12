import Anthropic from '@anthropic-ai/sdk'
import { MODEL_HAIKU } from '@/lib/ai/models'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getCachedAI, setCachedAI } from '@/lib/ai-cache'

const anthropic = new Anthropic()

export interface SleepRoutineResult {
  target_sleep_hours: number
  target_bedtime: string
  presleep_routine: string[]
  environment_tips: string[]
  recovery_priority: string[]
  explanation: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!await checkRateLimit(`${user.id}:sleep-routine`, 5, 60 * 60 * 1000)) return rateLimitResponse()

  const body = await request.json() as {
    sleep_issues?: string[]
    quality_rating?: number
    avg_sleep_hours?: number
    work_stress?: number
    stress_impact?: string[]
    primary_goal?: string
    sleep_target_weeknight?: string
    wake_time?: string
    training_days?: string[]
    env_dark?: boolean
    env_cool?: boolean
    whoop_avg_sleep_hours?: number | null
    whoop_avg_sleep_performance?: number | null
    whoop_avg_recovery_score?: number | null
  }

  // Cache key covers inputs that drive the recommendation (stable settings, not dynamic metrics)
  const cacheKey = `ai:sleep-routine:${user.id}:${JSON.stringify([
    body.primary_goal, body.wake_time, body.sleep_target_weeknight,
    body.training_days?.slice().sort().join(','), body.sleep_issues?.slice().sort().join(','),
    body.env_dark, body.env_cool,
  ])}`
  const cached = await getCachedAI<SleepRoutineResult>(cacheKey)
  if (cached) return Response.json(cached)

  const {
    sleep_issues = [],
    quality_rating = 6,
    avg_sleep_hours = 7,
    work_stress = 5,
    stress_impact = [],
    primary_goal = 'General Health',
    sleep_target_weeknight,
    wake_time,
    training_days = [],
    env_dark,
    env_cool,
    whoop_avg_sleep_hours,
    whoop_avg_sleep_performance,
    whoop_avg_recovery_score,
  } = body

  const actualSleepHours = whoop_avg_sleep_hours ?? avg_sleep_hours
  const whoopContext = whoop_avg_sleep_hours
    ? `WHOOP data: ${whoop_avg_sleep_hours.toFixed(1)}h avg sleep, ${whoop_avg_sleep_performance ? Math.round(whoop_avg_sleep_performance) + '% sleep performance' : ''}, ${whoop_avg_recovery_score ? Math.round(whoop_avg_recovery_score) + '% avg recovery score' : ''}`
    : null

  const prompt = `You are a sleep specialist and performance coach. Create a concise, practical sleep protocol personalized to this person.

PROFILE:
- Goal: ${primary_goal}
- Sleep quality: ${quality_rating}/10
- Avg sleep: ${actualSleepHours.toFixed(1)} hrs${whoopContext ? ` (${whoopContext})` : ''}
- Sleep issues: ${sleep_issues.length > 0 ? sleep_issues.join(', ') : 'None reported'}
- Stress: ${work_stress}/10${stress_impact.length > 0 ? ` — affects: ${stress_impact.join(', ')}` : ''}
- Trains: ${training_days.length} days/week${training_days.length > 0 ? ` (${training_days.join(', ')})` : ''}
- Current bedtime: ${sleep_target_weeknight ?? 'not set'}
- Wake time: ${wake_time ?? 'not set'}
- Room dark: ${env_dark === false ? 'No — fix needed' : env_dark === true ? 'Yes' : 'Unknown'}
- Room cool: ${env_cool === false ? 'No — fix needed' : env_cool === true ? 'Yes' : 'Unknown'}

RULES:
- Performance/Muscle Gain goals need 8–9h; Fat Loss/General Health 7–8h
- High stress (≥7) means prioritise wind-down; address it in routine
- Sleep issues drive specific routine items (e.g. "Hard to fall asleep" → no screens 60min prior, box breathing)
- training_days ≥ 5 means recovery sleep is critical — push bedtime earlier
- Environment issues (not dark/cool) MUST appear in environment_tips
- presleep_routine must be ordered steps (earliest first), max 5 items, each under 10 words
- recovery_priority: list in order of impact for this person, max 3 items

Return ONLY valid JSON, no markdown:
{
  "target_sleep_hours": <number 7-9>,
  "target_bedtime": "<HH:MM — 24h, derived from wake time minus target hours>",
  "presleep_routine": ["<step 1>", "<step 2>", "<step 3>", "<step 4>", "<step 5>"],
  "environment_tips": ["<tip 1>", "<tip 2>"],
  "recovery_priority": ["<priority 1>", "<priority 2>", "<priority 3>"],
  "explanation": "<2 sentences max: the key driver behind these recommendations for this specific person>"
}`

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('')
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    const result = JSON.parse(raw) as SleepRoutineResult
    await setCachedAI(cacheKey, result, 86400)
    return Response.json(result)
  } catch (err) {
    console.error('[sleep-routine] failed:', err)
    return Response.json({ error: 'Failed to generate sleep protocol' }, { status: 500 })
  }
}
