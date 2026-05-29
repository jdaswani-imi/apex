import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import {
  getRecentDailyLogs,
  getRecentRecovery,
  getRecentSleep,
  getRecentTraining,
  getUserGoals,
  getUserTraining,
  getOnboardingData,
} from '@/lib/db'
import {
  buildWeekIntelligence,
  FLAG_LABELS,
  type DayFlag,
  type DayData,
} from '@/lib/intelligence'
import { getCachedAI, setCachedAI, delCachedAI } from '@/lib/ai-cache'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export interface MorningIntelligence {
  yesterday_score: number | null
  yesterday_quality: string
  yesterday_flags: DayFlag[]
  week_weighted_avg: number | null
  week_trend: string
  day_scores: { date: string; score: number | null; quality: string }[]
  message: string
  recovery_actions: string[]
  tone: 'recovery' | 'momentum' | 'maintenance'
  page_insights: {
    food: string
    sleep: string
    supplements: string
    training: string
  }
  week_pattern: string | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!await checkRateLimit(`rl:morning:${user.id}`, 10, 3600_000)) return rateLimitResponse()

  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `ai:morning:${user.id}:${today}`
  const refresh = new URL(request.url).searchParams.get('refresh') === 'true'
  if (refresh) {
    await delCachedAI(cacheKey)
  } else {
    const cached = await getCachedAI<MorningIntelligence>(cacheKey)
    if (cached) return Response.json(cached, { headers: { 'Cache-Control': 'private, max-age=7200' } })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 8)
  const fromDate = cutoff.toISOString().split('T')[0]

  const [dailyLogs, recoveries, sleeps, sessions, goals, trainingConfig, onboarding, suppResult, foodResult] = await Promise.all([
    getRecentDailyLogs(8),
    getRecentRecovery(8),
    getRecentSleep(8),
    getRecentTraining(8),
    getUserGoals(),
    getUserTraining(),
    getOnboardingData(),
    supabase
      .from('supplement_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: false }),
    supabase
      .from('food_logs')
      .select('date, calories, protein_g, carbs_g, fats_g')
      .eq('user_id', user.id)
      .gte('date', fromDate),
  ])

  const suppLogs = suppResult.data ?? []

  // Aggregate food_logs by date
  const foodByDate: Record<string, { calories: number; protein_g: number; carbs_g: number; fats_g: number }> = {}
  for (const row of (foodResult.data ?? [])) {
    if (!foodByDate[row.date]) foodByDate[row.date] = { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
    foodByDate[row.date].calories += row.calories ?? 0
    foodByDate[row.date].protein_g += row.protein_g ?? 0
    foodByDate[row.date].carbs_g += row.carbs_g ?? 0
    foodByDate[row.date].fats_g += row.fats_g ?? 0
  }

  const logByDate = Object.fromEntries(dailyLogs.map(l => [l.date, l]))
  const recovByDate = Object.fromEntries(recoveries.map(r => [r.date, r]))
  const sleepByDate = Object.fromEntries(sleeps.map(s => [s.date, s]))

  const sessionsByDate: Record<string, typeof sessions> = {}
  for (const s of sessions) {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = []
    sessionsByDate[s.date].push(s)
  }

  const suppsByDate: Record<string, typeof suppLogs> = {}
  for (const s of suppLogs) {
    if (!suppsByDate[s.date]) suppsByDate[s.date] = []
    suppsByDate[s.date].push(s)
  }

  const dayDataList: DayData[] = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().split('T')[0]
    const baseLog = logByDate[date] ?? null
    const foodAgg = foodByDate[date] ?? null
    // Merge food_logs aggregates into daily_log — food_logs is the authoritative
    // source for nutrition since food entries are stored there, not daily_logs
    const log = foodAgg
      ? {
          ...(baseLog ?? { id: '', user_id: user.id, date, created_at: '', weight_kg: null, steps: null, notes: null, day_rating_training: null, day_rating_nutrition: null, day_rating_sleep: null, day_rating_supplements: null, feeling_recovery: null, feeling_sleep_quality: null, feeling_sleep_hours: null, feeling_strain: null }),
          calories: foodAgg.calories > 0 ? Math.round(foodAgg.calories) : (baseLog?.calories ?? null),
          protein_g: foodAgg.protein_g > 0 ? Math.round(foodAgg.protein_g * 10) / 10 : (baseLog?.protein_g ?? null),
          carbs_g: foodAgg.carbs_g > 0 ? Math.round(foodAgg.carbs_g * 10) / 10 : (baseLog?.carbs_g ?? null),
          fats_g: foodAgg.fats_g > 0 ? Math.round(foodAgg.fats_g * 10) / 10 : (baseLog?.fats_g ?? null),
        }
      : baseLog
    dayDataList.push({
      date,
      log,
      recovery: recovByDate[date] ?? null,
      sleep: sleepByDate[date] ?? null,
      supplements: suppsByDate[date] ?? [],
      sessions: sessionsByDate[date] ?? [],
    })
  }

  const trainingSplit = (trainingConfig as { training_split?: Record<string, string> } | null)?.training_split ?? null
  const proteinTarget = goals?.daily_protein_target_g ?? 140
  const stepsTarget = goals?.daily_steps_target ?? 10000

  const intel = buildWeekIntelligence(
    dayDataList,
    { daily_protein_target_g: proteinTarget, daily_steps_target: stepsTarget },
    trainingSplit,
  )

  const tone: 'recovery' | 'momentum' | 'maintenance' =
    intel.yesterdayScore !== null && intel.yesterdayScore < 50 && intel.yesterdayFlags.filter(f => f !== 'no_data').length >= 2
      ? 'recovery'
      : intel.yesterdayScore !== null && (intel.yesterdayScore < 70 || intel.yesterdayFlags.filter(f => f !== 'no_data').length >= 1)
      ? 'momentum'
      : 'maintenance'

  // ── Per-page context ──────────────────────────────────────────────────────

  const yest = dayDataList[0] // yesterday
  const yProtein = yest.log?.protein_g ?? null
  const yCals = yest.log?.calories ?? null
  const ySleepHrs = yest.sleep?.duration_hrs ?? null
  const ySleepPerf = yest.sleep?.sleep_performance_pct ?? null
  const yDeep = yest.sleep?.deep_sleep_min ?? null
  const yREM = yest.sleep?.rem_min ?? null
  const yRecovery = yest.recovery?.recovery_score ?? null
  const ySuppTaken = yest.supplements.filter(s => s.taken).length
  const ySuppTotal = yest.supplements.length
  const yMissedSupps = yest.supplements.filter(s => !s.taken).map(s => s.supplement_name)
  const yTrained = yest.sessions.length > 0

  // Subjective wellness from yesterday's log
  const yFeelingRecovery = yest.log?.feeling_recovery ?? null
  const yFeelingSleep = yest.log?.feeling_sleep_quality ?? null
  const yFeelingStrain = yest.log?.feeling_strain ?? null
  const yLogNote = yest.log?.notes ?? null

  // Check if WHOOP score and subjective feeling diverge significantly
  const whoopVsSubjectiveDivergence =
    yRecovery !== null && yFeelingRecovery !== null
      ? (() => {
          const whoopNorm = yRecovery / 100
          const subjNorm = (yFeelingRecovery - 1) / 4
          const diff = Math.abs(whoopNorm - subjNorm)
          if (diff > 0.3) return yRecovery > yFeelingRecovery * 20 ? 'whoop_higher' : 'subjective_higher'
          return null
        })()
      : null

  // today's scheduled session
  const todayDow = new Date().getDay()
  const todayScheduled = trainingSplit?.[todayDow.toString()] ?? null
  const todayIsRest = !todayScheduled || todayScheduled.toLowerCase() === 'rest'

  // 7-day averages
  const validLogs = dayDataList.filter(d => d.log?.protein_g != null)
  const avgProtein7 = validLogs.length > 0
    ? Math.round(validLogs.reduce((s, d) => s + (d.log?.protein_g ?? 0), 0) / validLogs.length)
    : null

  const validSleeps = dayDataList.filter(d => d.sleep?.duration_hrs != null)
  const avgSleep7 = validSleeps.length > 0
    ? Math.round((validSleeps.reduce((s, d) => s + (d.sleep?.duration_hrs ?? 0), 0) / validSleeps.length) * 10) / 10
    : null

  const scheduledTrainingDays = trainingSplit
    ? dayDataList.filter(d => {
        const dow = new Date(d.date + 'T12:00:00').getDay()
        const s = trainingSplit[dow.toString()]
        return s && s.toLowerCase() !== 'rest'
      }).length
    : null
  const completedSessions = dayDataList.filter(d => d.sessions.length > 0).length

  // ── User profile context from onboarding ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ob = (onboarding ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obCoaching = (ob.coaching ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obPhysical  = (ob.physical  ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obSleep     = (ob.sleep_ext ?? {}) as Record<string, any>

  const coachingStyle  = (obCoaching.coaching_style     as string) || 'Direct & blunt'
  const bluntness      = (obCoaching.feedback_bluntness as number) ?? 4
  const primaryGoal    = (obPhysical.primary_goal       as string) || 'General Health'
  const targetWeight   = (obPhysical.target_weight_kg   as number) ?? (goals?.target_weight_kg as number) ?? null
  const injuries:      string[] = (obPhysical.injuries_list ?? []).filter((i: string) => i !== 'None')
  const sleepIssues:   string[] = obSleep.sleep_issues ?? []
  const userGoalContext = goals?.target_event_name
    ? `target event: ${goals.target_event_name as string}${goals.target_event_date ? ` on ${goals.target_event_date as string}` : ''}`
    : targetWeight ? `target weight: ${targetWeight}kg` : primaryGoal

  // ── HRV baseline: avg of days 2-7 excluding yesterday ────────────────────
  const yHRV = yest.recovery?.hrv_rmssd_milli ?? null
  const ySpO2 = yest.recovery?.spo2_percentage ?? null
  const hrvValues = dayDataList.slice(1).map(d => d.recovery?.hrv_rmssd_milli).filter((v): v is number => v != null)
  const hrvBaseline = hrvValues.length >= 3
    ? Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length)
    : null
  const hrvDeviationPct = yHRV !== null && hrvBaseline !== null
    ? Math.round(((yHRV - hrvBaseline) / hrvBaseline) * 100)
    : null

  // ── Sleep architecture quality flags ─────────────────────────────────────
  const excellentDeep = yDeep !== null && yDeep >= 90
  const excellentREM = yREM !== null && yREM >= 90
  const sleepArchitectureNote = excellentDeep && excellentREM
    ? `⭐ Exceptional sleep architecture: ${yDeep}min deep + ${yREM}min REM — both above average. Acknowledge this win; it supports optimal physical and cognitive recovery.`
    : excellentDeep
    ? `✓ Strong deep sleep: ${yDeep}min (above average, supports physical recovery).`
    : excellentREM
    ? `✓ Strong REM sleep: ${yREM}min (above average, supports cognitive recovery).`
    : null

  // ── Build AI prompt ───────────────────────────────────────────────────────

  const actionableFlags = intel.yesterdayFlags.filter(f => f !== 'no_data')
  const flagText = actionableFlags.length > 0
    ? actionableFlags.map(f => FLAG_LABELS[f]).join(', ')
    : 'solid overall effort'

  const trendText =
    intel.trend === 'improving' ? 'improving over the last 7 days'
    : intel.trend === 'declining' ? 'declining over the last 7 days'
    : intel.trend === 'stable' ? 'stable over the last 7 days'
    : 'not enough data yet'

  const weekAvg = intel.weightedAverage !== null ? `${intel.weightedAverage}/100` : 'unknown'

  const prompt = `You are Apex, a personal optimisation coach. Generate a morning briefing. Tone: ${coachingStyle}, bluntness ${bluntness}/5${bluntness >= 4 ? ' — say it straight' : ''}. Return ONLY valid JSON, no markdown.
${todayIsRest ? '\n⚠️ CRITICAL — TODAY IS A SCHEDULED REST DAY. Your message and ALL three recovery_actions must NOT mention training, workouts, or exercise sessions. Focus exclusively on recovery, nutrition, sleep, and supplement habits. The training page_insight should acknowledge the rest day and advise on active recovery (walking, mobility, light movement) only.' : ''}

USER:
- Goal: ${userGoalContext}
${injuries.length > 0 ? `- Injuries: ${injuries.join(', ')} — factor into training advice` : ''}
${sleepIssues.filter((i: string) => i !== 'None').length > 0 ? `- Known sleep issues: ${sleepIssues.filter((i: string) => i !== 'None').join(', ')}` : ''}

CONTEXT:
- Yesterday's overall score: ${intel.yesterdayScore ?? 'no data'}/100 (${intel.yesterdayQuality})
- Weighted 7-day average: ${weekAvg}
- Trend: ${trendText}
- Yesterday's gaps: ${flagText}

DETAILED YESTERDAY DATA:
- Protein: ${yProtein !== null ? `${yProtein}g vs ${proteinTarget}g target (${Math.round((yProtein / proteinTarget) * 100)}%)` : 'not logged'}
- Calories: ${yCals !== null ? `${yCals} kcal` : 'not logged'}
- Sleep: ${ySleepHrs !== null ? `${ySleepHrs}h${ySleepPerf !== null ? `, ${ySleepPerf}% performance` : ''}${yDeep !== null ? `, ${yDeep}min deep` : ''}${yREM !== null ? `, ${yREM}min REM` : ''}` : 'no data'}
${sleepArchitectureNote ? `- ${sleepArchitectureNote}` : ''}
- Recovery (WHOOP): ${yRecovery !== null ? `${yRecovery}%` : 'no WHOOP data'}
${yHRV !== null ? `- HRV yesterday: ${Math.round(yHRV)}ms${hrvBaseline !== null ? ` (${hrvDeviationPct !== null && hrvDeviationPct > 0 ? '+' : ''}${hrvDeviationPct}% vs ${hrvBaseline}ms baseline — ${hrvDeviationPct !== null && hrvDeviationPct >= 10 ? 'elevated: strong recovery signal' : hrvDeviationPct !== null && hrvDeviationPct <= -15 ? 'suppressed: possible fatigue or stress' : 'within normal range'})` : ''}` : ''}
${ySpO2 !== null ? `- SpO₂: ${parseFloat(String(ySpO2)).toFixed(1)}%${parseFloat(String(ySpO2)) < 95 ? ' ⚠️ below optimal (normal ≥95%) — flag this in your sleep insight' : ''}` : ''}
${yFeelingRecovery !== null ? `- How they felt (subjective recovery): ${yFeelingRecovery}/5` : ''}
${yFeelingSleep !== null ? `- Felt sleep quality: ${yFeelingSleep}/5` : ''}
${yFeelingStrain !== null ? `- Felt ready for strain: ${yFeelingStrain}/5` : ''}
${whoopVsSubjectiveDivergence === 'whoop_higher' ? '⚠️ WHOOP shows better recovery than how they felt — may be building fatigue the sensor hasn\'t caught yet. Prioritise caution.' : ''}
${whoopVsSubjectiveDivergence === 'subjective_higher' ? '⚠️ They felt better than WHOOP scored — could be mental resilience or sensor lag. Moderate approach.' : ''}
${yLogNote ? `- Yesterday's log note: "${yLogNote}" — use this context in your message` : ''}
- Supplements: ${ySuppTotal > 0 ? `${ySuppTaken}/${ySuppTotal} taken${yMissedSupps.length > 0 ? `, missed: ${yMissedSupps.slice(0, 3).join(', ')}${yMissedSupps.length > 3 ? '...' : ''}` : ''}` : 'none scheduled'}
- Training: ${yTrained ? 'completed a session' : 'no session logged'}

7-DAY AVERAGES:
- Avg protein: ${avgProtein7 !== null ? `${avgProtein7}g` : 'unknown'}
- Avg sleep: ${avgSleep7 !== null ? `${avgSleep7}h` : 'unknown'}
- Training sessions: ${completedSessions}${scheduledTrainingDays !== null ? `/${scheduledTrainingDays} scheduled days` : ' in last 7 days'}

TODAY:
- Scheduled training: ${todayIsRest ? 'rest day — NO training recommended' : (todayScheduled ?? 'not configured')}

Return this exact JSON:
{
  "message": "<2-sentence morning message — sentence 1: acknowledge yesterday with the most specific data point (protein hit/miss, sleep duration, or recovery score); sentence 2: name the single most important action for today with a specific number — if rest day, do NOT mention training>",
  "week_pattern": "<1 sentence identifying the dominant 7-day pattern most impacting performance — be specific with numbers (e.g. 'Protein averaged Xg vs Yg target all week' or 'HRV has been Z% below baseline for 5 days')>",
  "recovery_actions": ["<action + brief why it matters: e.g. 'Hit 145g protein — averaging 118g this week'>", "<action + brief why>", "<action + brief why>"],
  "page_insights": {
    "food": "<1 sentence referencing yesterday's protein/calorie numbers and one clear quantified goal for today, e.g. 'Hit Xg protein across 3+ meals'>",
    "sleep": "<1 sentence referencing yesterday's sleep architecture — call out exceptional deep/REM if present, and one concrete habit improvement for tonight>",
    "supplements": "<1 sentence about yesterday's adherence with specific supplement names if missed, action for today>",
    "training": "<if rest day: acknowledge rest day and suggest light active recovery e.g. 20min walk or mobility work; otherwise give specific training advice based on recovery score>"
  }
}`

  const weekPatternFallback: string | null = (() => {
    if (avgProtein7 !== null && avgProtein7 < proteinTarget * 0.85) {
      return `Protein has averaged ${avgProtein7}g vs your ${proteinTarget}g target all week — this gap is the highest-impact thing to close.`
    }
    if (avgSleep7 !== null && avgSleep7 < 7.0) {
      return `Sleep has averaged ${avgSleep7}h over 7 days — adding consistent sleep time is your biggest recovery unlock.`
    }
    if (scheduledTrainingDays !== null && completedSessions < scheduledTrainingDays * 0.6) {
      return `Training adherence is ${completedSessions}/${scheduledTrainingDays} scheduled sessions — closing this consistency gap drives the most progress.`
    }
    if (intel.trend === 'improving') {
      return `Your 7-day performance trend is improving — sustain the consistency to compound these gains.`
    }
    if (intel.trend === 'declining') {
      return `Performance has been declining over 7 days — identify the main gap (protein, sleep, or training) and close it today.`
    }
    return null
  })()

  let message = ''
  let recovery_actions: string[] = []
  let week_pattern: string | null = null
  let page_insights = {
    food: '',
    sleep: '',
    supplements: '',
    training: '',
  }

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(raw) as {
      message: string
      week_pattern?: string
      recovery_actions: string[]
      page_insights: { food: string; sleep: string; supplements: string; training: string }
    }
    message = parsed.message ?? ''
    week_pattern = parsed.week_pattern ?? weekPatternFallback
    recovery_actions = Array.isArray(parsed.recovery_actions) ? parsed.recovery_actions : []
    page_insights = {
      food: parsed.page_insights?.food ?? '',
      sleep: parsed.page_insights?.sleep ?? '',
      supplements: parsed.page_insights?.supplements ?? '',
      training: parsed.page_insights?.training ?? '',
    }
  } catch {
    // Deterministic fallbacks using real data
    message =
      tone === 'recovery' ? "Every day is a reset — let's make today a strong one."
      : tone === 'momentum' ? "Good effort yesterday — keep the consistency going."
      : "You're building real momentum — let's keep it rolling."

    recovery_actions = [
      `Hit ${proteinTarget}g protein`,
      'Take all scheduled supplements',
      `Reach ${stepsTarget.toLocaleString()} steps`,
    ]

    page_insights = {
      food: yProtein !== null
        ? `Yesterday you hit ${yProtein}g protein — ${yProtein >= proteinTarget ? 'great work, maintain that today' : `${proteinTarget - yProtein}g short of your ${proteinTarget}g target — aim higher today`}.`
        : `Log your meals today to track progress toward your ${proteinTarget}g protein target.`,

      sleep: ySleepHrs !== null
        ? `Last night was ${ySleepHrs}h sleep${ySleepPerf !== null ? ` at ${ySleepPerf}% performance` : ''} — ${ySleepHrs >= 7.5 ? 'solid rest, protect this routine' : 'aim for an earlier bedtime tonight to improve recovery'}.`
        : avgSleep7 !== null
        ? `Your 7-day sleep average is ${avgSleep7}h — ${avgSleep7 >= 7 ? 'solid foundation' : 'try getting to bed 30 minutes earlier tonight'}.`
        : 'Connect WHOOP to track your sleep patterns and get smarter recovery insights.',

      supplements: ySuppTotal > 0
        ? ySuppTaken === ySuppTotal
          ? `Full supplement adherence yesterday — keep the streak going by taking them at the same times today.`
          : `You missed ${yMissedSupps.slice(0, 2).join(' and ')}${yMissedSupps.length > 2 ? ` and ${yMissedSupps.length - 2} more` : ''} yesterday — mark them taken as you go today.`
        : 'Configure your daily supplements to start tracking adherence.',

      training: todayIsRest
        ? `Rest day today — ${yTrained ? 'great session yesterday, let your body recover' : 'use the day for recovery and prep for tomorrow'}.`
        : `${todayScheduled} session scheduled today${yRecovery !== null ? ` — recovery at ${yRecovery}%, ${yRecovery >= 67 ? 'push hard' : yRecovery >= 34 ? 'train smart' : 'consider reducing intensity'}` : ''}.`,
    }
    week_pattern = weekPatternFallback
  }

  const result: MorningIntelligence = {
    yesterday_score: intel.yesterdayScore,
    yesterday_quality: intel.yesterdayQuality,
    yesterday_flags: intel.yesterdayFlags,
    week_weighted_avg: intel.weightedAverage,
    week_trend: intel.trend,
    day_scores: intel.scoredDays.map(d => ({
      date: d.date,
      score: d.score,
      quality: d.quality,
    })),
    message,
    recovery_actions,
    tone,
    page_insights,
    week_pattern,
  }

  await setCachedAI(cacheKey, result, 7200)
  return Response.json(result, {
    headers: { 'Cache-Control': 'private, max-age=7200' },
  })
}
