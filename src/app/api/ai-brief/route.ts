import Anthropic from '@anthropic-ai/sdk'
import { getTodayContext, getFullUserContext, getUserGoals, getUserTraining, getRecentTraining, getExerciseBaselines } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { buildWeekIntelligence, FLAG_LABELS, type DayData } from '@/lib/intelligence'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getCachedAI, setCachedAI, delCachedAI } from '@/lib/ai-cache'

const anthropic = new Anthropic()

export interface DailyBrief {
  readiness: number          // 0-100
  readiness_label: string    // 'Peak', 'Good', 'Moderate', 'Low'
  priorities: string[]       // exactly 3 short action items
  insight: string            // 1 sentence pattern observation
  training_rec: string       // what to do today training-wise
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!await checkRateLimit(`${user.id}:ai-brief`, 10, 60 * 60 * 1000)) return rateLimitResponse()

  const todayDate = new Date().toISOString().split('T')[0]
  const cacheKey = `ai:brief:${user.id}:${todayDate}`
  const refresh = new URL(request.url).searchParams.get('refresh') === 'true'
  if (refresh) {
    await delCachedAI(cacheKey)
  } else {
    const cached = await getCachedAI<DailyBrief>(cacheKey)
    if (cached) return Response.json(cached, { headers: { 'Cache-Control': 'private, max-age=7200' } })
  }

  const [ctx, userCtx, goals, trainingConfig, suppResult, recentSessions, baselines] = await Promise.all([
    getTodayContext(),
    getFullUserContext(),
    getUserGoals(),
    getUserTraining(),
    supabase
      .from('supplement_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', (() => { const d = new Date(); d.setDate(d.getDate() - 8); return d.toISOString().split('T')[0] })())
      .order('date', { ascending: false }),
    getRecentTraining(21),
    getExerciseBaselines(),
  ])
  if (!ctx) return new Response('Unauthorized', { status: 401 })

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const recovery = ctx.recovery?.recovery_score ?? null
  const hrv = ctx.recovery?.hrv_rmssd_milli ?? null
  const rhr = ctx.recovery?.resting_heart_rate ?? null
  const sleep = ctx.sleep
  const protein = ctx.foodTotals.protein ?? ctx.dailyLog?.protein_g ?? 0
  const proteinTarget = (userCtx.goals?.daily_protein_target_g as number) ?? 140
  const calories = ctx.foodTotals.calories ?? ctx.dailyLog?.calories ?? 0
  const calorieTarget = (userCtx.goals?.daily_calorie_target as number) ?? 2100
  const steps = ctx.dailyLog?.steps ?? 0
  const stepsTarget = (goals?.daily_steps_target as number) ?? 10000

  const recentProtein7 = ctx.recentLogs.slice(0, 7).map(l => l.protein_g ?? 0)
  const avgProtein7 = recentProtein7.length
    ? Math.round(recentProtein7.reduce((a, b) => a + b, 0) / recentProtein7.length)
    : null

  const recentRecovery7 = ctx.recentRecovery.slice(0, 7).map(r => r.recovery_score ?? 0)
  const avgRecovery7 = recentRecovery7.length
    ? Math.round(recentRecovery7.reduce((a, b) => a + b, 0) / recentRecovery7.length)
    : null

  // HRV baseline: 7-day rolling average for context
  const recentHRVValues = ctx.recentRecovery.slice(0, 7).map(r => r.hrv_rmssd_milli).filter((v): v is number => v != null)
  const hrvBaseline = recentHRVValues.length >= 3
    ? Math.round(recentHRVValues.reduce((a, b) => a + b, 0) / recentHRVValues.length)
    : null
  const todayHRVDevPct = hrv !== null && hrvBaseline !== null
    ? Math.round(((hrv - hrvBaseline) / hrvBaseline) * 100)
    : null

  // Today's SpO2 for health flag
  const todaySpO2 = ctx.recovery?.spo2_percentage ?? null
  const spO2Warning = todaySpO2 !== null && parseFloat(String(todaySpO2)) < 95

  // Build weighted week intelligence
  const suppLogs = suppResult.data ?? []
  const trainingSplit = (trainingConfig as { training_split?: Record<string, string> } | null)?.training_split ?? null

  const recovByDate = Object.fromEntries(ctx.recentRecovery.map(r => [r.date, r]))
  const sleepByDate = Object.fromEntries(ctx.recentSleep.map(s => [s.date, s]))
  const logByDate = Object.fromEntries(ctx.recentLogs.map(l => [l.date, l]))
  const suppsByDate: Record<string, typeof suppLogs> = {}
  for (const s of suppLogs) {
    if (!suppsByDate[s.date]) suppsByDate[s.date] = []
    suppsByDate[s.date].push(s)
  }

  const weekDayData: DayData[] = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().split('T')[0]
    weekDayData.push({
      date,
      log: logByDate[date] ?? null,
      recovery: recovByDate[date] ?? null,
      sleep: sleepByDate[date] ?? null,
      supplements: suppsByDate[date] ?? [],
      sessions: [],
    })
  }

  const intel = buildWeekIntelligence(
    weekDayData,
    { daily_protein_target_g: proteinTarget, daily_steps_target: stepsTarget },
    trainingSplit,
  )

  const actionableYesterdayFlags = intel.yesterdayFlags.filter(f => f !== 'no_data')
  const weekIntelContext = [
    intel.weightedAverage !== null ? `Weighted 7-day performance avg: ${intel.weightedAverage}/100` : '',
    intel.trend !== 'insufficient_data' ? `Trend: ${intel.trend}` : '',
    intel.yesterdayScore !== null ? `Yesterday's score: ${intel.yesterdayScore}/100 (${intel.yesterdayQuality})` : '',
    actionableYesterdayFlags.length > 0
      ? `Yesterday's gaps: ${actionableYesterdayFlags.map(f => FLAG_LABELS[f]).join(', ')}`
      : '',
  ].filter(Boolean).join('. ')

  type BM = { name: string; value: string; unit: string; status: string; note?: string }
  const lab = userCtx.latestLab?.structured_data as { biomarkers?: BM[] } | null
  const labOutOfRange = lab?.biomarkers?.filter((b: BM) => b.status === 'out_of_range') ?? []
  const labContext = labOutOfRange.length > 0
    ? `\n- Recent blood work flags: ${labOutOfRange.map((b: BM) => `${b.name} ${b.value}${b.unit}`).join(', ')}`
    : ''

  // Subjective wellness ratings from today's log
  const feelingRecovery = ctx.dailyLog?.feeling_recovery ?? null
  const feelingSleep = ctx.dailyLog?.feeling_sleep_quality ?? null
  const feelingStrain = ctx.dailyLog?.feeling_strain ?? null
  const todayLogNote = ctx.dailyLog?.notes ?? null

  const subjectiveContext = [
    feelingRecovery !== null ? `subjective recovery: ${feelingRecovery}/5` : '',
    feelingSleep !== null ? `felt sleep quality: ${feelingSleep}/5` : '',
    feelingStrain !== null ? `readiness for training: ${feelingStrain}/5` : '',
  ].filter(Boolean).join(', ')

  // ── Workout cycle position + last equivalent session ─────────────────────
  const todayDow = new Date().getDay()
  const todayScheduled = trainingSplit?.[todayDow.toString()] ?? null
  const todayIsRest = !todayScheduled || /rest|off/i.test(todayScheduled)

  const normType = (t: string) => t.toLowerCase().replace(/\s+day$/i, '').replace(/[_]+/g, ' ').trim()

  const trainingDayEntries = trainingSplit
    ? Object.entries(trainingSplit)
        .filter(([, v]) => !/rest|off/i.test(v))
        .sort(([a], [b]) => Number(a) - Number(b))
    : []

  const lastCycleSession = recentSessions.find(s =>
    !!s.finished_at && !!s.template_id && !/^rest.?day$/i.test(s.session_type)
  ) ?? null

  const nextInCycle: string | null = (() => {
    if (trainingDayEntries.length === 0) return todayScheduled
    if (!lastCycleSession) return trainingDayEntries[0]?.[1] ?? null
    const lastNorm = normType(lastCycleSession.session_type)
    const lastIdx = trainingDayEntries.findIndex(([, t]) => normType(t) === lastNorm)
    if (lastIdx === -1) return trainingDayEntries[0]?.[1] ?? null
    return trainingDayEntries[(lastIdx + 1) % trainingDayEntries.length]?.[1] ?? null
  })()

  const upcomingType = nextInCycle ?? todayScheduled

  const lastMatchingSession = !todayIsRest && upcomingType
    ? recentSessions.find(s =>
        !!s.finished_at &&
        normType(s.session_type).includes(normType(upcomingType)) &&
        s.date !== new Date().toISOString().split('T')[0]
      ) ?? null
    : null

  type BaselineRow = {
    session_type: string
    exercise_name: string
    current_weight_kg: number | null
    current_reps: number | null
    target_weight_kg: number | null
    target_reps: number | null
  }
  const sessionBaselines: BaselineRow[] = !todayIsRest && upcomingType
    ? (baselines as BaselineRow[]).filter(b =>
        normType(b.session_type).includes(normType(upcomingType)) ||
        normType(upcomingType).includes(normType(b.session_type))
      )
    : []

  const trainingContext = todayIsRest
    ? `- Today is a scheduled rest day — do NOT recommend gym training`
    : [
        `- Session: ${upcomingType}${upcomingType !== todayScheduled ? ` (cycle position — split shows ${todayScheduled})` : ''}`,
        lastMatchingSession
          ? `- Last ${upcomingType} session: ${lastMatchingSession.date}${lastMatchingSession.volume_kg ? `, ${lastMatchingSession.volume_kg}kg total volume` : ''}${lastMatchingSession.prs ? `, ${lastMatchingSession.prs} PR(s)` : ''}`
          : `- No previous ${upcomingType} session on record — first time`,
        sessionBaselines.length > 0
          ? `- Key targets: ${sessionBaselines.slice(0, 4).map(b => `${b.exercise_name} ${b.current_weight_kg}kg×${b.current_reps}→target ${b.target_weight_kg}kg×${b.target_reps}`).join(' | ')}`
          : '',
      ].filter(Boolean).join('\n')

  const obPhysical = userCtx.onboarding?.physical as { primary_goal?: string; secondary_goal?: string } | null
  const primaryGoal = obPhysical?.primary_goal ?? 'General Health'
  const secondaryGoal = obPhysical?.secondary_goal ?? null
  const goalContext = `${primaryGoal}${secondaryGoal ? ` + ${secondaryGoal}` : ''}`
  const isWeightLoss = primaryGoal.toLowerCase().includes('fat') || primaryGoal.toLowerCase().includes('loss') || primaryGoal.toLowerCase().includes('cut')

  const prompt = `Today is ${today}. Generate a personalised daily brief for this athlete. Return ONLY valid JSON, no markdown, no explanation.

GOAL: ${goalContext}${isWeightLoss ? ' — this user is in a deliberate calorie deficit. Do NOT flag under-eating as a problem if calories are below target; treat hitting protein targets while staying under calorie target as success.' : ''}

DATA:
- Recovery score: ${recovery ?? 'no WHOOP data'}${hrv ? `, HRV: ${Math.round(hrv)}ms${hrvBaseline !== null ? ` (${todayHRVDevPct !== null && todayHRVDevPct > 0 ? '+' : ''}${todayHRVDevPct}% vs ${hrvBaseline}ms baseline)` : ''}` : ''}${rhr ? `, RHR: ${rhr}bpm` : ''}
${spO2Warning ? `- ⚠️ SpO₂: ${parseFloat(String(todaySpO2)).toFixed(1)}% — below optimal (normal ≥95%). Consider flagging breathing quality.` : ''}
- Sleep last night: ${sleep?.duration_hrs ? `${sleep.duration_hrs}h, ${sleep.sleep_performance_pct ?? '—'}% performance, deep: ${sleep.deep_sleep_min ?? '—'}min${sleep.deep_sleep_min !== null && sleep.deep_sleep_min >= 90 ? ' ⭐ exceptional' : ''}, REM: ${sleep.rem_min ?? '—'}min${sleep.rem_min !== null && sleep.rem_min >= 90 ? ' ⭐ exceptional' : ''}` : 'no data'}
- Nutrition today: ${protein}g protein (target ${proteinTarget}g), ${calories} kcal (target ${calorieTarget})
- Steps today: ${steps.toLocaleString()} / ${stepsTarget.toLocaleString()}
- 7-day avg protein: ${avgProtein7 ?? 'unknown'}g
- 7-day avg recovery: ${avgRecovery7 ?? 'unknown'}%
- Supplements taken: ${ctx.supplements.filter(s => s.taken).length}/${ctx.supplements.length}
${subjectiveContext ? `- How they feel today: ${subjectiveContext}` : ''}
${todayLogNote ? `- Today's note: "${todayLogNote}"` : ''}
- Week intelligence: ${weekIntelContext || 'insufficient data'}${labContext}

TRAINING:
${trainingContext}

PRIORITIES RULES — all three must follow these rules exactly:
1. Each priority must include a specific number or target (e.g. "Hit 145g protein today", "Reach 10,000 steps", not vague phrases like "eat protein-rich meals")
2. Steps priority must use the ACTUAL daily steps target: ${stepsTarget.toLocaleString()} — never a lower number
3. DO NOT use clinical or medical monitoring language (e.g. "Monitor lipid levels"). If blood work flags an issue, translate it to a specific food action (e.g. "Eat oily fish or sardines today for omega-3s" not "Monitor lipid levels with nutrition")
4. If protein is 0 today, make protein the #1 priority with the actual target gram number
5. Keep each priority under 12 words

Return this exact JSON shape:
{
  "readiness": <number 0-100, composite score based on recovery+sleep+recent trends>,
  "readiness_label": <"Peak" | "Good" | "Moderate" | "Low">,
  "priorities": [<3 specific quantified action strings, max 12 words each>],
  "insight": <1 sentence pattern observation from the 7-day data — if sleep architecture was exceptional today (deep or REM ≥90min), call it out; otherwise be specific about a pattern>,
  "training_rec": <if rest day: active recovery only (walk/mobility), max 10 words; otherwise: confirm session type, reference last session volume if available, give RPE target based on recovery — max 20 words>
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
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
    await setCachedAI(cacheKey, brief, 7200)
    return Response.json(brief, {
      headers: { 'Cache-Control': 'private, max-age=7200' },
    })
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
      training_rec: todayIsRest
        ? '20min walk or mobility work'
        : readinessScore < 34
        ? `Zone 2 only — ${upcomingType ?? 'session'} waits until recovery improves`
        : `${upcomingType ?? 'Scheduled session'} — ${readinessScore >= 67 ? 'push hard, RPE 8-9' : 'train smart, RPE 7-8'}`,
    }
    return Response.json(fallback, {
      headers: { 'Cache-Control': 'private, max-age=7200' },
    })
  }
}
