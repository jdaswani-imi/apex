import Anthropic from '@anthropic-ai/sdk'
import { getTodayContext, getFullUserContext, getUserGoals } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

export interface DailyBrief {
  readiness: number          // 0-100
  readiness_label: string    // 'Peak', 'Good', 'Moderate', 'Low'
  priorities: string[]       // exactly 3 short action items
  insight: string            // 1 sentence pattern observation
  training_rec: string       // what to do today training-wise
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const [ctx, userCtx, goals] = await Promise.all([
    getTodayContext(),
    getFullUserContext(),
    getUserGoals(),
  ])
  if (!ctx) return new Response('Unauthorized', { status: 401 })

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const recovery = ctx.recovery?.recovery_score ?? null
  const hrv = ctx.recovery?.hrv_rmssd_milli ?? null
  const rhr = ctx.recovery?.resting_heart_rate ?? null
  const sleep = ctx.sleep
  const log = ctx.dailyLog
  const protein = log?.protein_g ?? 0
  const proteinTarget = (userCtx.goals?.daily_protein_target_g as number) ?? 140
  const calories = log?.calories ?? 0
  const calorieTarget = (userCtx.goals?.daily_calorie_target as number) ?? 2100
  const steps = log?.steps ?? 0
  const stepsTarget = (goals?.daily_steps_target as number) ?? 10000

  const recentProtein7 = ctx.recentLogs.slice(0, 7).map(l => l.protein_g ?? 0)
  const avgProtein7 = recentProtein7.length
    ? Math.round(recentProtein7.reduce((a, b) => a + b, 0) / recentProtein7.length)
    : null

  const recentRecovery7 = ctx.recentRecovery.slice(0, 7).map(r => r.recovery_score ?? 0)
  const avgRecovery7 = recentRecovery7.length
    ? Math.round(recentRecovery7.reduce((a, b) => a + b, 0) / recentRecovery7.length)
    : null

  type BM = { name: string; value: string; unit: string; status: string; note?: string }
  const lab = userCtx.latestLab?.structured_data as { biomarkers?: BM[] } | null
  const labOutOfRange = lab?.biomarkers?.filter((b: BM) => b.status === 'out_of_range') ?? []
  const labContext = labOutOfRange.length > 0
    ? `\n- Recent blood work flags: ${labOutOfRange.map((b: BM) => `${b.name} ${b.value}${b.unit}`).join(', ')}`
    : ''

  const prompt = `Today is ${today}. Generate a personalised daily brief for this athlete. Return ONLY valid JSON, no markdown, no explanation.

DATA:
- Recovery score: ${recovery ?? 'no WHOOP data'}${hrv ? `, HRV: ${hrv}ms` : ''}${rhr ? `, RHR: ${rhr}bpm` : ''}
- Sleep last night: ${sleep?.duration_hrs ? `${sleep.duration_hrs}h, ${sleep.sleep_performance_pct ?? '—'}% performance, deep: ${sleep.deep_sleep_min ?? '—'}min, REM: ${sleep.rem_min ?? '—'}min` : 'no data'}
- Nutrition today: ${protein}g protein (target ${proteinTarget}g), ${calories} kcal (target ${calorieTarget})
- Steps today: ${steps.toLocaleString()} / ${stepsTarget.toLocaleString()}
- 7-day avg protein: ${avgProtein7 ?? 'unknown'}g
- 7-day avg recovery: ${avgRecovery7 ?? 'unknown'}%
- Supplements taken: ${ctx.supplements.filter(s => s.taken).length}/${ctx.supplements.length}${labContext}

Return this exact JSON shape:
{
  "readiness": <number 0-100, composite score based on recovery+sleep+recent trends>,
  "readiness_label": <"Peak" | "Good" | "Moderate" | "Low">,
  "priorities": [<3 short specific action strings, max 8 words each>],
  "insight": <1 sentence pattern observation from the 7-day data, be specific>,
  "training_rec": <what type of training to do today based on recovery, max 12 words>
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    const brief = JSON.parse(raw) as DailyBrief
    return Response.json(brief)
  } catch {
    // Fallback brief if AI fails
    const readinessScore = recovery ?? 70
    const readinessLabel =
      readinessScore >= 84 ? 'Peak' :
      readinessScore >= 67 ? 'Good' :
      readinessScore >= 34 ? 'Moderate' : 'Low'
    const fallback: DailyBrief = {
      readiness: readinessScore,
      readiness_label: readinessLabel,
      priorities: [
        `Hit ${proteinTarget}g protein today`,
        `Reach ${stepsTarget.toLocaleString()} steps`,
        'Log your meals',
      ],
      insight: 'Keep logging consistently for better insights.',
      training_rec: readinessScore < 34 ? 'Zone 2 cardio or rest only' : 'Train as scheduled',
    }
    return Response.json(fallback)
  }
}
