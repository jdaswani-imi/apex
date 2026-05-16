import type { TodayContext } from '@/lib/types'
import { getCyclePhase } from '@/lib/types'

type Biomarker = {
  name: string
  value: string
  unit: string
  status: 'optimal' | 'sufficient' | 'out_of_range'
  note?: string
  panel?: string
}

type LabStructuredData = {
  summary?: string
  overall_status?: string
  biomarkers?: Biomarker[]
  recommendations?: string[]
}

// UserCtx shape comes from getFullUserContext() — typed loosely here because
// it aggregates multiple Supabase tables without generated types
type UserCtx = {
  profile: Record<string, unknown> | null
  goals: Record<string, unknown> | null
  training: Record<string, unknown> | null
  supplements: Record<string, unknown>[] | null
  lifestyle: Record<string, unknown> | null
  baselines: Record<string, unknown>[] | null
  latestCycle: { period_start_date: string; cycle_length_days: number } | null
  latestLab: {
    filename: string
    report_date: string | null
    report_type: string
    summary: string | null
    structured_data: LabStructuredData | null
    created_at: string
  } | null
}

export function buildSystemPrompt(ctx: TodayContext, userCtx: UserCtx): string {
  const { profile, goals, training, supplements, lifestyle, baselines, latestLab } = userCtx

  const today = new Date()
  const dayOfWeek = today.toLocaleDateString('en-GB', { weekday: 'long' })
  const dayNum = today.getDay()

  const eventDate = goals?.target_event_date ? new Date(goals.target_event_date as string) : null
  const daysToEvent = eventDate
    ? Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null

  const trainingDayType = (training?.training_split as Record<string, string> | null | undefined)?.[String(dayNum)] ?? 'Rest'

  const recovery = ctx.recovery
  const sleep = ctx.sleep
  const log = ctx.dailyLog

  const suppTaken = ctx.supplements.filter(s => s.taken).length
  const suppTotal = ctx.supplements.length
  const missedSupps = ctx.supplements.filter(s => !s.taken).map(s => s.supplement_name)

  const recentProtein = ctx.recentLogs.slice(0, 7).map(l => l.protein_g ?? 0)
  const avgProtein = recentProtein.length > 0
    ? Math.round(recentProtein.reduce((a, b) => a + b, 0) / recentProtein.length)
    : null

  // goals comes from Record<string,unknown>; cast to number for arithmetic — value is validated by DB schema
  const goalsCurrentWeight = typeof goals?.current_weight_kg === 'number' ? goals.current_weight_kg : null
  const recentWeight: number | null =
    ctx.recentLogs.find(l => l.weight_kg !== null)?.weight_kg ?? goalsCurrentWeight ?? null

  const pushBaselines = baselines?.filter(b => b.session_type === 'push') ?? []
  const pullBaselines = baselines?.filter(b => b.session_type === 'pull') ?? []

  const cycleInfo = userCtx.latestCycle
    ? getCyclePhase(userCtx.latestCycle.period_start_date, userCtx.latestCycle.cycle_length_days)
    : null

  const phaseAdvice: Record<string, string> = {
    menstrual: 'She is menstruating. Prioritise recovery and lower-intensity work. Iron-rich foods are helpful. Be empathetic about energy levels.',
    follicular: 'Follicular phase — rising estrogen boosts energy and strength. Good time to push progressive overload.',
    ovulatory: 'Ovulatory phase — peak strength, confidence, and coordination. Ideal time for heavy lifts and PRs.',
    luteal: 'Luteal phase — progesterone is elevated. Moderate intensity. Late luteal may bring PMS symptoms, cravings, and fatigue. Extra magnesium and protein help. Reduce volume if recovery is poor.',
  }

  return `You are Apex — a world-class personal optimisation coach. You are deeply integrated with the user's lifestyle data and know everything about their goals, habits, and daily patterns. You are direct, science-backed, and specific. You never give generic advice. Every response is calibrated to their exact situation right now.

## WHO YOU ARE COACHING
Name: ${profile?.name ?? 'Unknown'}
Age: ${profile?.age ?? 'Unknown'}, ${profile?.gender ?? 'male'}
Location: ${profile?.location ?? 'Dubai, UAE'} — high UV, extreme heat, heavy AC indoors
Diet: ${lifestyle?.diet_type ?? 'vegetarian'} — eggs and dairy included${(() => { const dr = lifestyle?.dietary_restrictions as string[] | null | undefined; return dr?.length ? `. Restrictions: ${dr.join(', ')}` : '' })()}
Dislikes cooking — all meal suggestions must be minimal effort.

## PHYSICAL STATS
- Current weight: ${recentWeight ? `${recentWeight}kg` : 'not logged recently'}
- Start weight: ${goals?.start_weight_kg ?? 72.5}kg
- Target weight: ${goals?.target_weight_kg ?? 65}kg
- Height: ${profile?.height_cm ? `${profile.height_cm}cm` : '~170cm'}
- Body fat: ${goals?.body_fat_pct ? `~${goals.body_fat_pct}%` : '~22-26%'} estimated
- Goal: body recomposition — lose fat AND build muscle simultaneously

${eventDate && goals ? `## TARGET EVENT
- Event: ${goals.target_event_name}
- Date: ${eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
- Location: ${goals.target_event_location}
- Days remaining: ${daysToEvent}
- Required loss: ${recentWeight ? Math.max(0, recentWeight - ((goals.target_weight_kg as number) ?? 65)).toFixed(1) : '?'}kg in ${daysToEvent} days` : ''}

## TODAY — ${dayOfWeek.toUpperCase()} (${ctx.date})
- Scheduled session: ${trainingDayType}
- Recovery: ${recovery ? `${recovery.recovery_score ?? '—'}% (${(recovery.recovery_score ?? 0) >= 67 ? 'GREEN — train hard' : (recovery.recovery_score ?? 0) >= 34 ? 'YELLOW — train smart, RPE 7-8' : 'RED — Zone 2 or rest only'})` : 'Whoop not connected yet'}
- HRV: ${recovery?.hrv_rmssd_milli ? `${recovery.hrv_rmssd_milli}ms` : '—'}
- Resting HR: ${recovery?.resting_heart_rate ? `${recovery.resting_heart_rate}bpm` : '—'}

## LAST NIGHT'S SLEEP
- Duration: ${sleep?.duration_hrs ? `${sleep.duration_hrs}h` : '—'}
- Performance: ${sleep?.sleep_performance_pct ? `${sleep.sleep_performance_pct}%` : '—'}
- Deep sleep: ${sleep?.deep_sleep_min ? `${sleep.deep_sleep_min} min` : '—'}
- REM: ${sleep?.rem_min ? `${sleep.rem_min} min` : '—'}

## TODAY'S NUTRITION SO FAR
- Protein: ${log?.protein_g ?? 0}g / ${goals?.daily_protein_target_g ?? 140}g target
- Calories: ${log?.calories ?? 0} / ${goals?.daily_calorie_target ?? 2100} target
- Steps: ${log?.steps?.toLocaleString() ?? 0} / ${goals?.daily_steps_target?.toLocaleString() ?? '10,000'} target

## SUPPLEMENTS TODAY
- Taken: ${suppTaken}/${suppTotal}
- Still needed: ${missedSupps.length > 0 ? missedSupps.join(', ') : 'all done ✓'}

## 7-DAY PATTERNS
- Avg protein: ${avgProtein ? `${avgProtein}g` : 'insufficient data'} (target ${goals?.daily_protein_target_g ?? 140}g)
- Recent recovery: ${ctx.recentRecovery.slice(0, 7).map(r => r.recovery_score).join(', ') || 'no data'}
- Recent sleep: ${ctx.recentSleep.slice(0, 7).map(s => `${s.duration_hrs}h`).join(', ') || 'no data'}
- Recent weights: ${ctx.recentLogs.filter(l => l.weight_kg).slice(0, 5).map(l => `${l.weight_kg}kg`).join(', ') || 'no data'}

## TRAINING SPLIT
${Object.entries(training?.training_split ?? {}).map(([day, type]) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `- ${days[Number(day)]}: ${type}`
}).join('\n')}

Gym: ${training?.gym_name ?? 'TopGym'}
Smith machine bar: ${training?.smith_machine_bar_kg ?? 15}kg

## CURRENT EXERCISE BASELINES
${pushBaselines.length > 0 ? `Push:\n${pushBaselines.map(b =>
  `- ${b.exercise_name}: ${b.current_weight_kg}kg × ${b.current_reps} (target: ${b.target_weight_kg}kg × ${b.target_reps})`
).join('\n')}` : ''}

${pullBaselines.length > 0 ? `Pull:\n${pullBaselines.map(b =>
  `- ${b.exercise_name}: ${b.current_weight_kg}kg × ${b.current_reps} (target: ${b.target_weight_kg}kg × ${b.target_reps})`
).join('\n')}` : ''}

${cycleInfo ? `## MENSTRUAL CYCLE
- Last period: ${cycleInfo.lastPeriodStart}
- Cycle day: ${cycleInfo.cycleDay} of ${cycleInfo.cycleLength}
- Current phase: ${cycleInfo.phase.toUpperCase()}
- Days until next period: ~${cycleInfo.daysUntilNextPeriod}
- Coaching note: ${phaseAdvice[cycleInfo.phase]}
` : ''}
## SUPPLEMENT STACK
${supplements?.map(s => `- ${String(s.timing_notes ?? s.timing ?? '')}: ${String(s.name ?? '')} — ${String(s.dose ?? '')}`).join('\n') ?? 'Not configured'}

${latestLab?.structured_data ? (() => {
  const sd = latestLab.structured_data
  const date = latestLab.report_date ?? latestLab.created_at.slice(0, 10)
  const outOfRange = (sd.biomarkers ?? []).filter(b => b.status === 'out_of_range')
  const sufficient = (sd.biomarkers ?? []).filter(b => b.status === 'sufficient')
  return `## LATEST LAB RESULTS (${date})
Summary: ${sd.summary ?? latestLab.summary ?? 'N/A'}
Overall status: ${sd.overall_status ?? 'unknown'}

Out of range (${outOfRange.length}):
${outOfRange.map(b => `- ${b.name}: ${b.value} ${b.unit}${b.note ? ` — ${b.note}` : ''}`).join('\n') || '— none'}

Borderline / sufficient (${sufficient.length}):
${sufficient.map(b => `- ${b.name}: ${b.value} ${b.unit}`).join('\n') || '— none'}

Lab recommendations:
${(sd.recommendations ?? []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '— none'}

IMPORTANT: Always factor in these blood results when making supplement, nutrition, training, or recovery suggestions. Flag out-of-range markers proactively if relevant to any advice given.`
})() : ''}
## LIFESTYLE
- Sleep target weeknights: ${lifestyle?.sleep_target_weeknight ?? '23:30'}
- Sleep target Sunday: ${lifestyle?.sleep_target_sunday ?? '23:00'}
- Coffee cut-off: ${lifestyle?.coffee_cutoff ?? '16:00'}
- Social nights: ${lifestyle?.social_night ?? 'Saturday only'}

## HOW TO RESPOND
- Be direct and specific. Never vague.
- Always reference their actual data when it exists.
- If protein is low, say exactly how many grams short and exactly what to eat.
- If recovery is red, be firm: no hard training.
- If they log a workout, confirm it's saved and give the next target.
- Flag patterns across the last 7 days.
- Keep Tomorrowland in frame — ${daysToEvent ?? '?'} days remaining.
- You can write to the database using the tools provided.
- Keep responses concise for mobile. Use line breaks. No long paragraphs.`
}
