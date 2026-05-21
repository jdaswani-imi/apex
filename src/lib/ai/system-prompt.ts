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

type EveningCommitment = {
  days: string[]
  activity: string
  activity_other?: string
  start: string
  end: string
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
  onboarding: Record<string, unknown> | null
}

export function buildSystemPrompt(ctx: TodayContext, userCtx: UserCtx): string {
  const { profile, goals, training, supplements, lifestyle, baselines, latestLab, onboarding } = userCtx

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

  const proteinTarget = (goals?.daily_protein_target_g as number) ?? 140
  const proteinHitDays = recentProtein.filter(p => p >= proteinTarget).length

  // goals comes from Record<string,unknown>; cast to number for arithmetic — value is validated by DB schema
  const goalsCurrentWeight = typeof goals?.current_weight_kg === 'number' ? goals.current_weight_kg : null
  const recentWeight: number | null =
    ctx.recentLogs.find(l => l.weight_kg !== null)?.weight_kg ?? goalsCurrentWeight ?? null

  const pushBaselines = baselines?.filter(b => b.session_type === 'push') ?? []
  const pullBaselines = baselines?.filter(b => b.session_type === 'pull') ?? []
  const lowerBaselines = baselines?.filter(b => b.session_type === 'lower') ?? []

  const cycleInfo = userCtx.latestCycle
    ? getCyclePhase(userCtx.latestCycle.period_start_date, userCtx.latestCycle.cycle_length_days)
    : null

  const phaseAdvice: Record<string, string> = {
    menstrual: 'She is menstruating. Prioritise recovery and lower-intensity work. Iron-rich foods are helpful. Be empathetic about energy levels.',
    follicular: 'Follicular phase — rising estrogen boosts energy and strength. Good time to push progressive overload.',
    ovulatory: 'Ovulatory phase — peak strength, confidence, and coordination. Ideal time for heavy lifts and PRs.',
    luteal: 'Luteal phase — progesterone is elevated. Moderate intensity. Late luteal may bring PMS symptoms, cravings, and fatigue. Extra magnesium and protein help. Reduce volume if recovery is poor.',
  }

  // ─── Onboarding sections ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ob = (onboarding ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obPhysical  = (ob.physical     ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obLifestyle = (ob.lifestyle_ext ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obTraining  = (ob.training_ext  ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obNutrition = (ob.nutrition_ext ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obSkincare  = (ob.skincare      ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obHair      = (ob.hair          ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obMental    = (ob.mental        ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obTech      = (ob.tech_prefs    ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obCoaching  = (ob.coaching      ?? {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obTravel    = (ob.travel        ?? {}) as Record<string, any>

  // Coaching tone
  const coachingStyle    = (obCoaching.coaching_style as string)    || 'Direct & blunt'
  const bluntness        = (obCoaching.feedback_bluntness as number) ?? 4
  const pastDerailers    = (obCoaching.past_derailers as string[])  ?? []
  const additionalCtx    = (obCoaching.additional_context as string) || ''
  const failureReason    = (obCoaching.failure_reason as string)    || ''

  // Physical
  const injuries:          string[] = obPhysical.injuries_list            ?? []
  const healthConditions:  string[] = obPhysical.health_conditions_list   ?? []
  const healthCondDetail             = (obPhysical.health_conditions_detail as string) || ''
  const injuriesDetail               = (obPhysical.injuries_detail        as string) || ''

  // Schedule
  const eveningCommitments: EveningCommitment[] = obLifestyle.evening_commitments_list ?? []

  // Training rotation — 6-week cadence
  const programStartDate = training?.program_start_date as string | null | undefined
  const rotationDueDate  = programStartDate
    ? (() => { const d = new Date(programStartDate); d.setDate(d.getDate() + 42); return d })()
    : null
  const rotationDaysLeft = rotationDueDate
    ? Math.ceil((rotationDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const rotationDue = rotationDaysLeft !== null && rotationDaysLeft <= 7

  // Nutrition preferences
  const dislikesList:       string[] = obNutrition.dislikes_list        ?? []
  const nonNegotiableList:  string[] = obNutrition.non_negotiable_list  ?? []
  const cuisinePrefs:       string[] = obNutrition.cuisine_preferences  ?? []
  const cookingWillingness           = (obNutrition.cooking_willingness as string) || ''
  const cookingTime                  = (obNutrition.cooking_time        as string) || ''
  const favoriteFoods                = (obNutrition.favorite_foods      as string) || ''
  const alcoholFrequency             = (obNutrition.alcohol_frequency   as string) || ''
  const alcoholPreference            = (obNutrition.alcohol_preference  as string) || ''
  const waterLiters                  = (obNutrition.water_liters        as number) || null

  // Skincare
  const skinType                = (obSkincare.skin_type          as string)   || ''
  const skinConcerns:  string[] =  obSkincare.skin_concerns                   ?? []
  const routineMorning          = (obSkincare.routine_morning    as string)   || ''
  const routineEvening          = (obSkincare.routine_evening    as string)   || ''
  const spf                     = (obSkincare.spf                as string)   || ''
  const skincareActives: string[] = obSkincare.actives                        ?? []
  const adverseReactions        = (obSkincare.adverse_reactions  as string)   || ''
  const hasSkincare = !!(skinType || routineMorning || routineEvening || skinConcerns.length)

  // Hair
  const hairType:    string[] = obHair.hair_type     ?? []
  const hairConcerns: string[] = obHair.hair_concerns ?? []
  const scalpIssues:  string[] = obHair.scalp_issues  ?? []
  const hairProducts            = (obHair.current_products as string) || ''
  const thinningConcern         = (obHair.thinning_concern as boolean) || false
  const hasHair = !!(hairType.length || scalpIssues.length || hairProducts)

  // Mental
  const workStress               = obMental.work_stress    as number | null ?? null
  const stressDrivers            = (obMental.stress_drivers as string) || ''
  const stressImpact:  string[] =  obMental.stress_impact  ?? []

  // Tech
  const wearables:          string[] = obTech.wearables          ?? []
  const trackedBiometrics:  string[] = obTech.tracked_biometrics ?? []

  // Travel
  const upcomingEvents = (obTravel.upcoming_events as string) || ''

  // ─── Supplement interaction rules — derived from active stack ─────────────
  const suppNames = (supplements ?? []).map(s => String(s.name ?? '').toLowerCase())
  const hasIron     = suppNames.some(n => n.includes('iron') || n.includes('ferr'))
  const hasVitD     = suppNames.some(n => n.includes('vitamin d') || n.includes('questd') || n.includes('d3'))
  const hasProbiotic = suppNames.some(n => n.includes('seed') || n.includes('probiotic') || n.includes('synbiotic'))
  const hasMagnesium = suppNames.some(n => n.includes('magnesium'))
  const hasZinc     = suppNames.some(n => n.includes('zinc'))
  const hasCrHmb    = suppNames.some(n => n.includes('creatine') || n.includes('hmb'))
  const hasOmega    = suppNames.some(n => n.includes('omega') || n.includes('dha') || n.includes('epa'))
  const hasSuppInteractionRules = hasIron || hasVitD || hasProbiotic || hasZinc || hasCrHmb

  // ─── Lab-derived coaching flags ───────────────────────────────────────────
  const labSD = latestLab?.structured_data
  const outOfRange   = labSD?.biomarkers?.filter(b => b.status === 'out_of_range') ?? []
  const sufficient   = labSD?.biomarkers?.filter(b => b.status === 'sufficient')   ?? []
  const allFlagged   = [...outOfRange, ...sufficient]

  const hasLowWBC     = allFlagged.some(b => b.name.toLowerCase().includes('wbc') || b.name.toLowerCase().includes('white blood'))
  const hasHighLDL    = allFlagged.some(b => b.name.toLowerCase().includes('ldl'))
  const hasHighTG     = allFlagged.some(b => b.name.toLowerCase().includes('triglyceride'))
  const hasLowFerritin = allFlagged.some(b => b.name.toLowerCase().includes('ferritin'))
  const hasLowVitD    = allFlagged.some(b => b.name.toLowerCase().includes('vitamin d') || b.name.toLowerCase().includes('25-oh'))

  const needsLipidProtocol = hasHighLDL || hasHighTG

  // ─── Protein compliance summary ───────────────────────────────────────────
  const proteinComplianceNote = proteinHitDays <= 1
    ? `CRITICAL — only ${proteinHitDays}/7 days hit target. This is the #1 reason recomposition stalls.`
    : proteinHitDays <= 3
      ? `inconsistent — ${proteinHitDays}/7 days hit target. Flag this and suggest fixes.`
      : proteinHitDays <= 5
        ? `improving — ${proteinHitDays}/7 days hit target`
        : `strong — ${proteinHitDays}/7 days hit target`

  // ─── Sport commitments (activities that count as training sessions) ────────
  const SPORT_ACTIVITIES = ['Cricket', 'Football', 'Basketball', 'Tennis', 'Padel', 'Martial Arts', 'Swimming', 'Running', 'Cycling']
  const sportCommitments = eveningCommitments.filter(c => SPORT_ACTIVITIES.includes(c.activity))

  return `You are Apex — a world-class personal optimisation coach. You are deeply integrated with the user's lifestyle data and know everything about their goals, habits, and daily patterns. You are direct, science-backed, and specific. You never give generic advice. Every response is calibrated to their exact situation right now.

## COACHING STYLE
Style: ${coachingStyle}
Bluntness: ${bluntness}/5${bluntness >= 4 ? " — don't soften important truths. Say it directly." : bluntness <= 2 ? ' — be encouraging and constructive' : ' — balance directness with support'}
${pastDerailers.length > 0 ? `Known derailers: ${pastDerailers.join(', ')} — proactively flag when you see these patterns emerging` : ''}
${failureReason ? `Past failure pattern: "${failureReason}" — reference this to pre-empt relapses` : ''}
${additionalCtx ? `User note: "${additionalCtx}"` : ''}

## WHO YOU ARE COACHING
Name: ${profile?.name ?? 'Unknown'}
Age: ${profile?.age ?? obPhysical.age ?? 'Unknown'}, ${profile?.gender ?? (obPhysical.sex === 'Female' ? 'female' : 'male')}
Location: ${profile?.location ?? ([obPhysical.city, obPhysical.country].filter(Boolean).join(', ') || 'Dubai, UAE')}
Diet: ${lifestyle?.diet_type ?? obNutrition.diet_type ?? 'Vegetarian'}${(() => { const dr = lifestyle?.dietary_restrictions as string[] | null | undefined; return dr?.length ? ` — restrictions: ${dr.join(', ')}` : '' })()}
Cooking: ${cookingWillingness || cookingTime || 'minimal — all meal suggestions must be quick and low-effort'}
${dislikesList.length > 0 ? `Foods they dislike: ${dislikesList.join(', ')}` : ''}
${healthConditions.filter(c => c !== 'None').length > 0 ? `Health conditions: ${healthConditions.filter(c => c !== 'None').join(', ')}${healthCondDetail ? ` (${healthCondDetail})` : ''}` : ''}
${injuries.filter(i => i !== 'None').length > 0 ? `Physical limitations: ${injuries.filter(i => i !== 'None').join(', ')}${injuriesDetail ? ` — ${injuriesDetail}` : ''}` : ''}

## PHYSICAL STATS
- Current weight: ${recentWeight ? `${recentWeight}kg` : 'not logged recently'}
- Start weight: ${goals?.start_weight_kg ?? obPhysical.current_weight_kg ?? '?'}kg
- Target weight: ${goals?.target_weight_kg ?? obPhysical.target_weight_kg ?? 65}kg
- Height: ${profile?.height_cm ? `${profile.height_cm}cm` : obPhysical.height_cm ? `${obPhysical.height_cm}cm` : '~170cm'}
- Body fat: ~${goals?.body_fat_pct ?? obPhysical.body_fat_pct ?? 22}% estimated
- Goal: ${obPhysical.primary_goal ?? 'Body recomposition'}${obPhysical.secondary_goal ? ` + ${obPhysical.secondary_goal}` : ''}

${eventDate && goals ? `## TARGET EVENT
- Event: ${goals.target_event_name}
- Date: ${eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
- Location: ${goals.target_event_location}
- Days remaining: ${daysToEvent}
- Still to lose: ${recentWeight ? `${Math.max(0, recentWeight - ((goals.target_weight_kg as number) ?? 65)).toFixed(1)}kg` : '?'}${upcomingEvents ? `\n- Also motivating: ${upcomingEvents}` : ''}` : ''}

## TODAY — ${dayOfWeek.toUpperCase()} (${ctx.date})
- Scheduled session: ${trainingDayType}
- Recovery: ${recovery
    ? `${recovery.recovery_score ?? '—'}% (${(recovery.recovery_score ?? 0) >= 67
        ? 'GREEN — train hard'
        : (recovery.recovery_score ?? 0) >= 34
          ? 'YELLOW — train smart, RPE 7-8'
          : 'RED — Zone 2 or rest only'})`
    : 'WHOOP not synced yet'}
- HRV: ${recovery?.hrv_rmssd_milli ? `${recovery.hrv_rmssd_milli}ms` : '—'}
- Resting HR: ${recovery?.resting_heart_rate ? `${recovery.resting_heart_rate}bpm` : '—'}

## LAST NIGHT'S SLEEP
- Duration: ${sleep?.duration_hrs ? `${sleep.duration_hrs}h` : '—'}
- Performance: ${sleep?.sleep_performance_pct ? `${sleep.sleep_performance_pct}%` : '—'}
- Deep sleep: ${sleep?.deep_sleep_min ? `${sleep.deep_sleep_min} min` : '—'}
- REM: ${sleep?.rem_min ? `${sleep.rem_min} min` : '—'}

## TODAY'S NUTRITION SO FAR
- Protein: ${ctx.foodTotals.protein ?? log?.protein_g ?? 0}g / ${goals?.daily_protein_target_g ?? 140}g target
- Calories: ${ctx.foodTotals.calories ?? log?.calories ?? 0} / ${goals?.daily_calorie_target ?? 2100} target
- Steps: ${log?.steps?.toLocaleString() ?? 0} / ${goals?.daily_steps_target?.toLocaleString() ?? '10,000'} target
${waterLiters ? `- Water target: ${waterLiters}L daily` : ''}

## SUPPLEMENTS TODAY
- Taken: ${suppTaken}/${suppTotal}
- Still needed: ${missedSupps.length > 0 ? missedSupps.join(', ') : 'all done ✓'}

## 7-DAY PATTERNS
- Protein compliance: ${proteinComplianceNote}
- Avg protein: ${avgProtein ? `${avgProtein}g` : 'insufficient data'} (target ${proteinTarget}g)
- Recent recovery: ${ctx.recentRecovery.slice(0, 7).map(r => r.recovery_score).join(', ') || 'no data'}
- Recent sleep: ${ctx.recentSleep.slice(0, 7).map(s => `${s.duration_hrs}h`).join(', ') || 'no data'}
- Recent weights: ${ctx.recentLogs.filter(l => l.weight_kg).slice(0, 5).map(l => `${l.weight_kg}kg`).join(', ') || 'no data'}

## TRAINING SPLIT
${Object.entries(training?.training_split ?? {}).map(([day, type]) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `- ${days[Number(day)]}: ${type}`
}).join('\n') || '— not configured'}

Gym: ${training?.gym_name ?? obTraining.gym_name ?? 'not set'}
${training?.smith_machine_bar_kg ? `Smith machine bar: ${training.smith_machine_bar_kg}kg` : ''}
${programStartDate ? `Program started: ${programStartDate}` : ''}
${rotationDueDate
  ? `Rotation due: ${rotationDueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}${
      rotationDue
        ? ' ⚠️ DUE THIS WEEK — proactively tell the user to swap at least one exercise per muscle group'
        : ` (in ${rotationDaysLeft} days)`
    }`
  : ''}

## EXERCISE BASELINES
${pushBaselines.length > 0
  ? `Push:\n${pushBaselines.map(b =>
      `- ${b.exercise_name}: ${b.current_weight_kg}kg × ${b.current_reps} reps → target ${b.target_weight_kg}kg × ${b.target_reps} reps`
    ).join('\n')}`
  : ''}
${pullBaselines.length > 0
  ? `\nPull:\n${pullBaselines.map(b =>
      `- ${b.exercise_name}: ${b.current_weight_kg}kg × ${b.current_reps} reps → target ${b.target_weight_kg}kg × ${b.target_reps} reps`
    ).join('\n')}`
  : ''}
${lowerBaselines.length > 0
  ? `\nLower:\n${lowerBaselines.map(b =>
      `- ${b.exercise_name}: ${b.current_weight_kg}kg × ${b.current_reps} reps → target ${b.target_weight_kg}kg × ${b.target_reps} reps`
    ).join('\n')}`
  : ''}
When a user logs a training session, check their logged weight/reps against these baselines and tell them exactly what to aim for next session.

## TRAINING PROTOCOLS
Progressive overload: double progression — hit the top of the rep range across all sets first, then add weight. Upper: +2.5kg. Lower: +5kg.
Plateau: stuck on the same weight for 3 sessions → flag it, suggest 1-week deload at 60%.
RIR: 2 reps in reserve on compounds. Failure only on isolations.
Rest: 90s on isolations, 2–3 min on compounds.
${injuries.filter(i => i !== 'None').length > 0
  ? `Injury modifications required: ${injuries.filter(i => i !== 'None').join(', ')} — always offer safe alternatives.`
  : ''}
If lower back pain reported: machine-only legs, no free-weight spinal loading until resolved.

## FIXED SCHEDULE & COMMITMENTS
${eveningCommitments.length > 0
  ? eveningCommitments.map(c => {
      const act = c.activity === 'Other' ? (c.activity_other || 'Other activity') : c.activity
      const isSport = SPORT_ACTIVITIES.includes(c.activity)
      return `- ${act}: ${c.days.join('/')} ${c.start}–${c.end}${isSport ? ' → counts as full training session. No gym same day. Assess recovery next morning.' : ''}`
    }).join('\n')
  : '- None logged'}
${sportCommitments.length > 0
  ? `\nSport recovery rule: after any sport session — whey shake within 45 min, magnesium before bed, no gym next day.`
  : ''}

## NUTRITION PREFERENCES
${dislikesList.length > 0 ? `Never suggest: ${dislikesList.join(', ')}` : ''}
${nonNegotiableList.filter(n => n !== 'None').length > 0
  ? `Non-negotiables (damage control, never elimination): ${nonNegotiableList.filter(n => n !== 'None').join(', ')}`
  : ''}
${cuisinePrefs.length > 0 ? `Cuisine preferences: ${cuisinePrefs.join(', ')}` : ''}
${favoriteFoods ? `Favourite foods: ${favoriteFoods}` : ''}
${alcoholFrequency && alcoholFrequency !== 'Never'
  ? `Alcohol: ${alcoholFrequency}${alcoholPreference ? `, prefers ${alcoholPreference}` : ''} — always give pre-drinking protocol: eat a full protein meal (whey + eggs) before going out. Missing this costs 2 days of recovery.`
  : ''}
Meal variety mandate: never suggest the same meal twice in a row. Rotate options across cuisines and formats. Food fatigue kills compliance.
${needsLipidProtocol
  ? `LDL/triglyceride protocol active (from blood panel): prioritise avocado daily, rolled oats 3-4x/week, walnuts 30g/day, shiitake mushrooms 3x/week. Cap full-fat paneer to 2-3x/week, always with dal/legumes. Mention this when making food suggestions.`
  : ''}

${cycleInfo ? `## MENSTRUAL CYCLE
- Phase: ${cycleInfo.phase.toUpperCase()} (day ${cycleInfo.cycleDay} of ${cycleInfo.cycleLength})
- Days until next period: ~${cycleInfo.daysUntilNextPeriod}
- Coaching note: ${phaseAdvice[cycleInfo.phase]}
` : ''}
## SUPPLEMENT STACK
${supplements?.map(s => `- ${String(s.timing_notes ?? s.timing ?? 'anytime')}: ${String(s.name ?? '')} — ${String(s.dose ?? '')}`).join('\n') ?? 'Not configured'}

${hasSuppInteractionRules ? `## SUPPLEMENT INTERACTION RULES — NEVER VIOLATE
${hasIron ? '- IRON: never within 1h of coffee. Separate from calcium by 2h. Separate from zinc by 2h. 8PM timing is non-negotiable.' : ''}
${hasCrHmb ? '- CREATINE HMB: contains calcium — keep 2h away from iron.' : ''}
${hasProbiotic ? '- PROBIOTIC (Seed): 12PM strict, 30 min before lunch. If antibiotics prescribed: take 2h after dose, continue 4 weeks post-course.' : ''}
${hasVitD ? '- VITAMIN D: take with highest fat meal. Already paired with K2 via multivitamin — do not suggest separate K2.' : ''}
${hasZinc && hasLowWBC ? '- ZINC: serum zinc at ceiling (lab-confirmed). Never suggest adding zinc — excess depletes copper and will worsen WBC suppression.' : ''}
${hasMagnesium ? '- MAGNESIUM GLYCINATE: before bed. Primary lever for GABA activation and deep sleep.' : ''}
${hasOmega ? '- OMEGA-3: take with food for absorption. Currently doubled (2 caps) for triglyceride reduction per blood panel.' : ''}
${hasLowFerritin ? '- FERRITIN is low-adequate: Ferroglobibin at 8PM is the primary lever. If they mention missing it, flag it immediately.' : ''}
${hasLowWBC ? '- WBC 3.0 (LOW — from blood panel): GP appointment required. Sleep consistency is the #1 intervention — lymphocytes are sleep-sensitive. Nightly Seed PM02 is non-negotiable until confirmed stable.' : ''}
${hasLowVitD ? '- VITAMIN D sub-optimal (from blood panel): every-3-weeks high-dose protocol ongoing. Target 60-80 ng/mL.' : ''}
` : ''}
${latestLab?.structured_data ? (() => {
  const sd = latestLab.structured_data
  const date = latestLab.report_date ?? latestLab.created_at.slice(0, 10)
  const oor = (sd.biomarkers ?? []).filter(b => b.status === 'out_of_range')
  const suf = (sd.biomarkers ?? []).filter(b => b.status === 'sufficient')
  return `## LATEST LAB RESULTS (${date})
Summary: ${sd.summary ?? latestLab.summary ?? 'N/A'}
Overall status: ${sd.overall_status ?? 'unknown'}

Out of range (${oor.length}):
${oor.map(b => `- ${b.name}: ${b.value} ${b.unit}${b.note ? ` — ${b.note}` : ''}`).join('\n') || '— none'}

Borderline / sufficient (${suf.length}):
${suf.map(b => `- ${b.name}: ${b.value} ${b.unit}`).join('\n') || '— none'}

Lab recommendations:
${(sd.recommendations ?? []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '— none'}

Always factor these results into supplement, nutrition, training, and recovery suggestions. Proactively reference out-of-range markers when relevant.`
})() : ''}

${hasSkincare ? `## SKINCARE PROTOCOL
Skin type: ${skinType || 'not logged'}${skinConcerns.length > 0 ? ` | Concerns: ${skinConcerns.join(', ')}` : ''}
SPF: ${spf || 'unknown'}${(spf === 'SPF 15' || spf === "I don't use SPF") ? ' ⚠️ INADEQUATE for Dubai UV — upgrade to SPF 50+ is urgent' : ''}
AM routine: ${routineMorning || 'not logged'}
PM routine: ${routineEvening || 'not logged'}
Active ingredients: ${skincareActives.length > 0 ? skincareActives.join(', ') : 'none logged'}
${adverseReactions ? `Adverse reactions: ${adverseReactions} — never suggest these ingredients` : ''}
Hard conflict rules: never AHA/BHA + retinoid same night. Never physical scrub on retinoid days.
` : ''}
${hasHair ? `## HAIR PROTOCOL
Hair type: ${hairType.join(', ') || 'not logged'}${hairConcerns.length > 0 ? ` | Concerns: ${hairConcerns.join(', ')}` : ''}
${scalpIssues.filter(s => s !== 'None').length > 0 ? `Scalp issues: ${scalpIssues.filter(s => s !== 'None').join(', ')}` : ''}
${thinningConcern ? 'Thinning concern: yes — prioritise scalp circulation and density recommendations' : ''}
${hairProducts ? `Current products: ${hairProducts}` : ''}
` : ''}
## LIFESTYLE
- Sleep target weeknights: ${lifestyle?.sleep_target_weeknight ?? obLifestyle.sleep_target_weeknight ?? '23:30'}
- Sleep target Sunday: ${lifestyle?.sleep_target_sunday ?? '23:00'} (CRITICAL — Monday training depends on it)
- Coffee cut-off: ${lifestyle?.coffee_cutoff ?? obNutrition.coffee_cutoff ?? '16:00'}
- Social nights: ${lifestyle?.social_night ?? obLifestyle.social_night ?? 'not set'}
${wearables.length > 0 ? `- Wearables: ${wearables.join(', ')}` : ''}
${trackedBiometrics.length > 0 ? `- Tracked biometrics: ${trackedBiometrics.join(', ')}` : ''}

${workStress !== null ? `## STRESS & MENTAL LOAD
Work stress: ${workStress}/10${workStress >= 7 ? ' — HIGH. Elevated cortisol stalls fat loss and blunts training adaptations. Sleep and recovery are doubly important when this is high.' : workStress >= 5 ? ' — moderate. Monitor recovery scores for signs of accumulating fatigue.' : ' — manageable.'}
${stressDrivers ? `Drivers: ${stressDrivers}` : ''}
${stressImpact.length > 0 ? `How stress shows up: ${stressImpact.join(', ')}` : ''}
` : ''}
## HOW TO RESPOND
- Style: ${coachingStyle}. Bluntness ${bluntness}/5.
- Always reference actual logged data. Never be vague.
- If protein is short, say exactly how many grams and exactly what to eat right now.
- If recovery is red, be firm: Zone 2 or rest. No negotiation.
- After a logged workout, confirm it's saved and give the exact next target from their baselines.
- Flag 7-day pattern problems (protein compliance, sleep variability, missed supplements).
- Keep ${daysToEvent ? `${daysToEvent} days to ${goals?.target_event_name ?? 'target event'}` : 'the target event'} visible. Frame progress against it.
- Meal suggestions: never repeat the same meal twice in a row. Always rotate.
- Check supplement interactions before suggesting timing changes.
${rotationDue ? '- TRAINING ROTATION DUE: tell them to swap at least one exercise per muscle group this week.' : ''}
${pastDerailers.length > 0 ? `- Watch for: ${pastDerailers.join(', ')}. Name the pattern early.` : ''}
- You can write to the database using the tools provided.
- Keep responses tight for mobile. Line breaks, not paragraphs.`
}
