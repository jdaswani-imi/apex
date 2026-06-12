import type { ReactNode } from 'react'
import { todayLocal } from '@/lib/date'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTodayContext, getUserGoals } from '@/lib/db'
import { getDaysToEvent, cn } from '@/lib/utils'
import { Zap, Scale, Music2, Moon, Activity, UtensilsCrossed, CalendarDays, Info, ChevronRight, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { QualitativeCheckin } from '@/components/qualitative-checkin'
import { DayNav } from '@/components/day-nav'
import { AITipButton } from '@/components/ai-tip-button'
import { AiBriefCard } from '@/components/ai-brief-card'
import { TodayWorkoutCard } from '@/components/training/TodayWorkoutCard'
import { UserMenu } from '@/components/user-menu'
import { SUPPLEMENT_CATALOG } from '@/lib/supplements-catalog'
import { DashboardSupplementStack } from '@/components/dashboard-supplement-stack'
import { WhoopAutoSync } from '@/components/whoop-auto-sync'
import { MorningIntelligenceCard } from '@/components/morning-intelligence-card'
import { StepsCard } from '@/components/steps-card'

export const dynamic = 'force-dynamic'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function getWeekDays(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd.toISOString().split('T')[0]
  })
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: onboarding } = await supabase
    .from('user_onboarding')
    .select('completed, interests')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!onboarding?.completed) redirect('/onboarding')

  const focusedSections = (onboarding?.interests as { focused_sections?: string[] } | null)?.focused_sections ?? null
  const showSleep = focusedSections === null || focusedSections.includes('sleep')
  const showSupplements = focusedSections === null || focusedSections.includes('supplements')

  const todayStr = todayLocal()
  const maxFutureDate = (() => {
    const d = new Date(todayStr + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()
  const params = await searchParams
  const rawDate = params.date ?? todayStr
  // clamp between earliest available and today+7
  const date = rawDate > maxFutureDate ? maxFutureDate : rawDate
  const isToday = date === todayStr
  const isFutureDate = date > todayStr

  const [ctx, goals] = await Promise.all([
    getTodayContext(date),
    getUserGoals(),
  ])
  if (!ctx) redirect('/login')

  const eventDate = goals?.target_event_date ?? null
  const days = eventDate ? getDaysToEvent(date, eventDate) : null
  const stepsTarget = goals?.daily_steps_target ?? 10000
  const weightTarget = goals?.target_weight_kg ?? null
  const proteinTarget = goals?.daily_protein_target_g ?? null
  const calorieTarget = goals?.daily_calorie_target ?? null
  const eventName = goals?.target_event_name ?? null
  const eventLocation = goals?.target_event_location ?? null

  const eventDateFormatted = goals?.target_event_date
    ? new Date(goals.target_event_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const totalDays = (eventDate && goals?.program_start_date)
    ? getDaysToEvent(goals.program_start_date, eventDate)
    : null
  const progress = (days !== null && totalDays !== null && totalDays > 0)
    ? Math.min(100, Math.round(((totalDays - days) / totalDays) * 100))
    : 0
  const initials = (user.email ?? 'J').slice(0, 1).toUpperCase()

  const recovery = ctx.recovery?.recovery_score ?? null
  const protein = ctx.foodTotals.protein ?? ctx.dailyLog?.protein_g ?? null
  const carbs = ctx.foodTotals.carbs ?? ctx.dailyLog?.carbs_g ?? null
  const fats = ctx.foodTotals.fats ?? ctx.dailyLog?.fats_g ?? null
  const calories = ctx.foodTotals.calories ?? ctx.dailyLog?.calories ?? null
  const steps = ctx.dailyLog?.steps ?? null
  const weight = ctx.dailyLog?.weight_kg
    ?? ctx.recentLogs.find(l => l.weight_kg !== null)?.weight_kg
    ?? null

  // Weight enrichment (after `weight` is resolved)
  const weightLogs = ctx.recentLogs.filter(l => l.weight_kg !== null).slice(0, 8)
  const weightSparkData = [...weightLogs].reverse().slice(-4)
  const weightGapToTarget = weight !== null && weightTarget !== null ? weightTarget - weight : null
  let weeklyWeightRate: string | null = null
  if (weightLogs.length >= 2) {
    const latest = weightLogs[0]
    const oldest = weightLogs[weightLogs.length - 1]
    const daysDiff = (new Date(latest.date).getTime() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 0) {
      const change = ((latest.weight_kg ?? 0) - (oldest.weight_kg ?? 0))
      const rate = (change / daysDiff) * 7
      weeklyWeightRate = (rate >= 0 ? '+' : '') + rate.toFixed(1)
    }
  }

  const hasMacros = protein !== null || carbs !== null || fats !== null


  // HRV baseline for recovery card display
  const todayHRV = ctx.recovery?.hrv_rmssd_milli ?? null
  const recentHRVValues = ctx.recentRecovery.slice(0, 7).map(r => r.hrv_rmssd_milli).filter((v): v is number => v != null)
  const hrvBaseline = recentHRVValues.length >= 3
    ? Math.round(recentHRVValues.reduce((a, b) => a + b, 0) / recentHRVValues.length)
    : null
  const hrvDevPct = todayHRV !== null && hrvBaseline !== null
    ? Math.round(((todayHRV - hrvBaseline) / hrvBaseline) * 100)
    : null

  const todaySpO2 = ctx.recovery?.spo2_percentage ?? null
  const spO2Low = todaySpO2 !== null && parseFloat(String(todaySpO2)) < 95

  const sortedSupplements = [...ctx.supplements].sort((a, b) => {
    const aEntry = SUPPLEMENT_CATALOG.find(e => e.name === a.supplement_name)
    const bEntry = SUPPLEMENT_CATALOG.find(e => e.name === b.supplement_name)
    return (aEntry?.sortOrder ?? 999) - (bEntry?.sortOrder ?? 999)
  })

  const suppTaken = ctx.supplements.filter(s => s.taken).length
  const suppTotal = ctx.supplements.length

  // Build week strip data
  const weekDays = getWeekDays(date)

  // Training session map for week strip encoding
  const trainingByDate: Record<string, { type: string; strain: number | null }> = {}
  for (const s of [...ctx.recentTrainingSessions].reverse()) {
    trainingByDate[s.date] = { type: s.session_type, strain: s.whoop_strain ?? null }
  }
  function sessionDotStyle(type: string, strain: number | null): { color: string; size: string } {
    const t = type.toLowerCase()
    // Exact hex-matched Tailwind classes: orange-500=#F97316, blue-500=#3B82F6, green-500=#22C55E, gray-500=#6B7280
    const color = /push/.test(t) ? 'bg-orange-500'
      : /pull/.test(t) ? 'bg-blue-500'
      : /leg|lower/.test(t) ? 'bg-green-500'
      : /cardio|zone|run|bike|swim/.test(t) ? 'bg-gray-500'
      : /rest/.test(t) ? 'bg-gray-500'
      : 'bg-orange-500' // unknown type → orange so it's always visible
    // Base 8px, scale up with strain
    const size = strain !== null && strain >= 18 ? 'w-3 h-3'
      : strain !== null && strain >= 14 ? 'w-2.5 h-2.5'
      : 'w-2 h-2'
    return { color, size }
  }

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8 space-y-4">
      <WhoopAutoSync />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
            {isToday ? getGreeting() : isFutureDate ? 'Looking ahead' : 'Past day'}
          </p>
          <DayNav date={date} todayStr={todayStr} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/week"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
            aria-label="Week view"
          >
            <CalendarDays size={18} />
          </Link>
          <UserMenu initials={initials} />
        </div>
      </div>

      {/* Week strip */}
      <div className="flex items-center justify-between gap-1">
        {weekDays.map((d, i) => {
          const isFuture = d > todayStr
          const isBeyondMax = d > maxFutureDate
          const isSelected = d === date
          const dayNum = new Date(d + 'T12:00:00').getDate()
          const session = trainingByDate[d] ?? null
          const hasSession = session !== null && !/^rest.?day$/i.test(session.type)
          const isRestDay = session !== null && /^rest.?day$/i.test(session.type)

          // Dot: session-type encoded for past days, recovery-based if no session
          let dotEl: ReactNode
          if (isFuture || isBeyondMax) {
            dotEl = <span className="w-2 h-2 rounded-full bg-muted-foreground/15" />
          } else if (hasSession) {
            const { color, size } = sessionDotStyle(session.type, session.strain)
            dotEl = <span className={cn('rounded-full', color, size)} />
          } else if (isRestDay) {
            dotEl = <span className="w-2 h-2 rounded-full bg-gray-600/70" />
          } else {
            // No session logged — empty ring (8px)
            dotEl = <span className="w-2 h-2 rounded-full border border-white/25" />
          }

          if (isBeyondMax) {
            return (
              <div
                key={d}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl"
              >
                <span className="text-[10px] font-bold text-muted-foreground/25">{DAY_LETTERS[i]}</span>
                <span className="text-sm font-semibold text-muted-foreground/25">{dayNum}</span>
                {dotEl}
              </div>
            )
          }

          return (
            <Link
              key={d}
              href={d === todayStr ? '/' : `/?date=${d}`}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all duration-150',
                isSelected && isFuture
                  ? 'bg-sky-500/15 border border-sky-500/30'
                  : isSelected
                  ? 'bg-orange-500/15 border border-orange-500/30'
                  : 'hover:bg-white/5'
              )}
            >
              <span className={cn(
                'text-[10px] font-bold',
                isSelected && isFuture ? 'text-sky-400' : isSelected ? 'text-orange-400' : isFuture ? 'text-muted-foreground/40' : 'text-muted-foreground'
              )}>
                {DAY_LETTERS[i]}
              </span>
              <span className={cn(
                'text-sm font-semibold',
                isSelected ? 'text-white' : isFuture ? 'text-muted-foreground/40' : 'text-muted-foreground'
              )}>
                {dayNum}
              </span>
              {dotEl}
            </Link>
          )
        })}
      </div>

      {/* SpO₂ alert banner */}
      {isToday && spO2Low && todaySpO2 !== null && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            SpO₂ below threshold ({parseFloat(String(todaySpO2)).toFixed(1)}%) — retest tonight
          </p>
        </div>
      )}

      {/* Morning intelligence check-in — today only */}
      {isToday && <MorningIntelligenceCard />}

      {/* AI Daily Brief — today only */}
      {isToday && (
        <AiBriefCard
          protein={protein}
          steps={steps}
          calories={calories}
          recovery={recovery}
          suppTaken={suppTaken}
          suppTotal={suppTotal}
        />
      )}

      {/* Today's session */}
      <TodayWorkoutCard isToday={isToday} date={date} />

      {/* Stats */}
      <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
      <div className="space-y-3">

        {/* Nutrition — full width */}
        <Link href={isToday ? '/food' : `/food?date=${date}`} className="bg-card border border-border rounded-2xl p-4 hover:border-orange-500/25 transition-all duration-200 block">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nutrition</span>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <UtensilsCrossed size={14} className="text-orange-400" />
              </div>
              <ChevronRight size={14} className="text-muted-foreground/30" />
            </div>
          </div>
          {hasMacros ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-4">
                {protein !== null && (
                  <div>
                    <span className="font-condensed text-3xl font-bold text-orange-300 leading-none">{protein}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground ml-1">P</span>
                  </div>
                )}
                {carbs !== null && (
                  <div>
                    <span className="font-condensed text-3xl font-bold text-yellow-300 leading-none">{carbs}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground ml-1">C</span>
                  </div>
                )}
                {fats !== null && (
                  <div>
                    <span className="font-condensed text-3xl font-bold text-blue-300 leading-none">{fats}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground ml-1">F</span>
                  </div>
                )}
              </div>
              {/* Protein progress bar */}
              {protein !== null && proteinTarget !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Protein</span>
                    <span className={cn('text-[10px] font-semibold', protein >= proteinTarget ? 'text-green-400' : 'text-muted-foreground')}>
                      {protein}g / {proteinTarget}g
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div
                      className={cn('h-1.5 rounded-full transition-all duration-500', protein >= proteinTarget ? 'bg-green-400' : 'bg-orange-400')}
                      style={{ width: `${Math.min(100, Math.round((protein / proteinTarget) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
              {/* Calorie progress bar */}
              {calories !== null && calorieTarget !== null && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Calories</span>
                    <span className={cn('text-[10px] font-semibold', calories >= calorieTarget ? 'text-green-400' : 'text-muted-foreground')}>
                      {calories.toLocaleString()} / {calorieTarget.toLocaleString()} kcal
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div
                      className={cn('h-1.5 rounded-full transition-all duration-500', calories >= calorieTarget ? 'bg-green-400' : 'bg-orange-500/60')}
                      style={{ width: `${Math.min(100, Math.round((calories / calorieTarget) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : calories !== null ? (
            <div className="flex items-baseline gap-2">
              <p className="font-condensed text-3xl font-bold leading-none text-orange-400">{calories.toLocaleString()}</p>
              <p className="text-muted-foreground text-xs">kcal · log macros</p>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="font-condensed text-3xl font-bold leading-none text-muted-foreground/50">—</p>
              <p className="text-muted-foreground text-xs">tap to log food</p>
            </div>
          )}
        </Link>

        {/* Steps | Weight — 2-col */}
        <div className="grid grid-cols-2 gap-3">
          {/* Steps */}
          <StepsCard
            key={date}
            date={date}
            initialSteps={steps}
            stepsTarget={stepsTarget}
            isToday={isToday}
          />
          {/* Weight */}
          <Link href="/progress" className="bg-card border border-border rounded-2xl p-4 transition-all duration-200 hover:border-white/15 block">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Weight</span>
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Scale size={14} className="text-green-400" />
                </div>
                <ChevronRight size={14} className="text-muted-foreground/30" />
              </div>
            </div>
            {weight !== null ? (
              <>
                <p className="font-condensed text-3xl font-bold leading-none text-green-400">{weight}kg</p>
                {weightGapToTarget !== null && (
                  <p className={cn('text-[10px] font-semibold mt-1.5', weightGapToTarget < 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                    {weightGapToTarget > 0 ? '+' : ''}{weightGapToTarget.toFixed(1)} kg to go
                  </p>
                )}
                {weeklyWeightRate !== null && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{weeklyWeightRate} kg/week avg</p>
                )}
                {weightSparkData.length >= 2 && (() => {
                  const vals = weightSparkData.map(l => l.weight_kg!)
                  const min = Math.min(...vals), max = Math.max(...vals)
                  const W = 52, H = 18
                  const pts = vals.map((v, i) => ({
                    x: vals.length > 1 ? Math.round((i / (vals.length - 1)) * (W - 4)) + 2 : W / 2,
                    y: max === min ? H / 2 : H - 2 - Math.round(((v - min) / (max - min)) * (H - 6)),
                  }))
                  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                  return (
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-2 overflow-visible">
                      <path d={pathD} fill="none" stroke="rgba(74,222,128,0.3)" strokeWidth="1" strokeLinejoin="round" />
                      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="#4ade80" />)}
                    </svg>
                  )
                })()}
              </>
            ) : (
              <>
                <p className="font-condensed text-3xl font-bold leading-none text-muted-foreground/40">— kg</p>
                {weightTarget !== null && (
                  <p className="text-[10px] font-semibold text-muted-foreground/60 mt-1.5">Target: {weightTarget} kg</p>
                )}
                <p className="text-[9px] text-muted-foreground/35 mt-0.5">· log weight</p>
                {/* Stub sparkline placeholder */}
                <svg width={52} height={18} viewBox="0 0 52 18" className="mt-2 overflow-visible">
                  <path d="M 2 10 L 18 10 L 34 10 L 50 10" fill="none" stroke="#6B7280" strokeWidth="1" strokeLinejoin="round" />
                  {[2, 18, 34, 50].map((x, i) => <circle key={i} cx={x} cy={10} r="3" fill="#6B7280" />)}
                </svg>
              </>
            )}
          </Link>
        </div>

      </div>{/* end left col */}
      <div className="space-y-3">

        {/* WHOOP Recovery — score + vitals merged into one card */}
        {(ctx.recovery || ctx.cycle) ? (
          <Link href={isToday ? '/sleep' : `/sleep?date=${date}`} className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/20 transition-all duration-200">
            {/* Card header: label + recovery score */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-primary" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Recovery</span>
              </div>
              <div className="flex items-center gap-2">
                {recovery !== null && (
                  <>
                    <span className={cn(
                      'font-condensed text-2xl font-bold leading-none',
                      recovery >= 67 ? 'text-green-400' : recovery >= 34 ? 'text-yellow-400' : 'text-red-400'
                    )}>{recovery}%</span>
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      recovery >= 67 ? 'bg-green-500/15 text-green-400' :
                      recovery >= 34 ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-red-500/15 text-red-400'
                    )}>
                      {recovery >= 67 ? 'Green' : recovery >= 34 ? 'Yellow' : 'Red'}
                    </span>
                  </>
                )}
                <ChevronRight size={14} className="text-muted-foreground/30" />
              </div>
            </div>
            {/* Vitals grid */}
            <div className="grid grid-cols-4 gap-3">
              {ctx.recovery?.hrv_rmssd_milli !== null && ctx.recovery?.hrv_rmssd_milli !== undefined && (
                <div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-foreground font-bold text-2xl leading-none">{Math.round(ctx.recovery.hrv_rmssd_milli)}</p>
                    {hrvDevPct !== null && (
                      <span className={cn(
                        'text-[9px] font-bold leading-none',
                        hrvDevPct >= 10 ? 'text-green-400' : hrvDevPct <= -15 ? 'text-red-400' : 'text-muted-foreground/50'
                      )}>
                        {hrvDevPct > 0 ? '+' : ''}{hrvDevPct}%
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[10px] mt-1.5 font-medium">HRV ms</p>
                  {hrvBaseline !== null && (
                    <p className="text-muted-foreground/40 text-[9px] mt-0.5">avg {hrvBaseline}ms</p>
                  )}
                </div>
              )}
              {ctx.recovery?.resting_heart_rate !== null && ctx.recovery?.resting_heart_rate !== undefined && (
                <div>
                  <p className="text-red-400 font-bold text-2xl leading-none">{ctx.recovery.resting_heart_rate}</p>
                  <p className="text-muted-foreground text-[10px] mt-1.5 font-medium">RHR bpm</p>
                </div>
              )}
              {ctx.recovery?.spo2_percentage !== null && ctx.recovery?.spo2_percentage !== undefined && (
                <div>
                  <div className="flex items-center gap-0.5">
                    {spO2Low && <AlertTriangle size={11} className="text-amber-400 shrink-0" />}
                    <p className={cn('font-bold text-2xl leading-none', spO2Low ? 'text-amber-400' : 'text-sky-400')}>
                      {parseFloat(String(ctx.recovery.spo2_percentage)).toFixed(1)}%
                    </p>
                  </div>
                  <p className="text-muted-foreground text-[10px] mt-1.5 font-medium">SpO₂</p>
                  {spO2Low && <p className="text-amber-400/70 text-[9px] mt-0.5">retest tonight</p>}
                </div>
              )}
              {ctx.cycle?.strain !== null && ctx.cycle?.strain !== undefined && (
                <div>
                  <p className={cn('font-bold text-2xl leading-none',
                    ctx.cycle.strain >= 18 ? 'text-red-400' :
                    ctx.cycle.strain >= 14 ? 'text-orange-400' :
                    ctx.cycle.strain >= 10 ? 'text-yellow-400' : 'text-green-400'
                  )}>{ctx.cycle.strain.toFixed(1)}</p>
                  <p className="text-muted-foreground text-[10px] mt-1.5 font-medium">Strain /21</p>
                </div>
              )}
            </div>
            {/* Insight reference row */}
            <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-1.5">
              <Info size={10} className="text-muted-foreground/50 shrink-0" />
              <p className="text-[10px] text-muted-foreground/50 leading-snug">HRV ≥50ms · RHR ≤55bpm · SpO₂ ≥95% = well recovered</p>
            </div>
          </Link>
        ) : (
          /* No WHOOP — show simple recovery card */
          <Link href={isToday ? '/sleep' : `/sleep?date=${date}`} className="bg-card border border-border rounded-2xl p-4 hover:border-white/15 transition-all duration-200 block">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Recovery</span>
              <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Zap size={14} className="text-yellow-400" />
              </div>
            </div>
            <p className="font-condensed text-3xl font-bold leading-none text-muted-foreground/50">—</p>
            <p className="text-xs text-muted-foreground mt-2">Connect WHOOP to track</p>
          </Link>
        )}

        {/* Sleep — last night summary */}
        {showSleep && ctx.sleep && (() => {
          const deepExcellent = (ctx.sleep.deep_sleep_min ?? 0) >= 90
          const remExcellent = (ctx.sleep.rem_min ?? 0) >= 90
          const sleepExcellent = deepExcellent && remExcellent
          return (
          <Link href={isToday ? '/sleep' : `/sleep?date=${date}`} className={cn(
            'bg-card border rounded-2xl p-4 hover:border-white/15 transition-all duration-200 block',
            sleepExcellent ? 'border-emerald-500/30' : 'border-border'
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Moon size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Last Night&apos;s Sleep</span>
              </div>
              <div className="flex items-center gap-2">
                {sleepExcellent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    Elite
                  </span>
                )}
                {ctx.sleep.sleep_performance_pct && (
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    ctx.sleep.sleep_performance_pct >= 70 ? 'bg-emerald-500/15 text-emerald-400' :
                    ctx.sleep.sleep_performance_pct >= 50 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
                  )}>{ctx.sleep.sleep_performance_pct}%</span>
                )}
                <ChevronRight size={14} className="text-muted-foreground/30" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Duration', value: ctx.sleep.duration_hrs ? `${ctx.sleep.duration_hrs}h` : '—', hint: 'aim 8h', highlight: false, pb: false },
                { label: 'Perf', value: ctx.sleep.sleep_performance_pct ? `${ctx.sleep.sleep_performance_pct}%` : '—', hint: '>85%', highlight: false, pb: false },
                { label: 'Deep', value: ctx.sleep.deep_sleep_min ? `${ctx.sleep.deep_sleep_min}m` : '—', hint: '>90m', highlight: deepExcellent, pb: deepExcellent },
                { label: 'REM', value: ctx.sleep.rem_min ? `${ctx.sleep.rem_min}m` : '—', hint: '>90m', highlight: remExcellent, pb: false },
              ].map(({ label, value, hint, highlight, pb }) => (
                <div key={label}>
                  <p className={cn('font-bold text-xl leading-none', highlight ? 'text-emerald-400' : 'text-foreground')}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">{label}</p>
                  {pb ? (
                    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 mt-0.5">PB</span>
                  ) : (
                    <p className={cn('text-[9px] mt-0.5', highlight ? 'text-emerald-400/60' : 'text-muted-foreground/40')}>{hint}</p>
                  )}
                </div>
              ))}
            </div>
          </Link>
          )
        })()}

      </div>{/* end right col */}
      </div>{/* end stats grid */}

      {/* Qualitative check-in (today only, when no WHOOP data) */}
      {showSleep && isToday && !ctx.recovery && !ctx.sleep && !ctx.cycle && (
        <QualitativeCheckin
          initialRecovery={ctx.dailyLog?.feeling_recovery ?? null}
          initialSleepQuality={ctx.dailyLog?.feeling_sleep_quality ?? null}
          initialSleepHours={ctx.dailyLog?.feeling_sleep_hours ?? null}
          initialStrain={ctx.dailyLog?.feeling_strain ?? null}
        />
      )}

      {/* Supplements */}
      {showSupplements && suppTotal > 0 && (
        <DashboardSupplementStack key={date} initialSupplements={sortedSupplements} date={date} />
      )}

      {/* Target event */}
      {eventDate && days !== null && (
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/90 via-violet-900/50 to-pink-950/70 p-5">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-3">
            <Music2 size={14} className="text-purple-400" />
            <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">{eventName ?? 'Target Event'}</span>
          </div>

          {/* Centrepiece: day count */}
          <div className="flex items-end justify-between mb-1">
            <div>
              <div className="flex items-baseline gap-2 leading-none">
                <span className="font-condensed text-8xl font-black text-white leading-none">{days}</span>
                <span className="text-sm font-semibold text-purple-300/70 mb-1">days to go</span>
              </div>
              <div className="mt-1">
                {weightGapToTarget !== null && Math.abs(weightGapToTarget) > 0.1 ? (
                  <p className="text-sm font-semibold text-amber-300/80">
                    {weightGapToTarget < 0 ? '−' : '+'}{Math.abs(weightGapToTarget).toFixed(1)} kg to goal
                  </p>
                ) : (
                  <p className="text-sm font-medium text-purple-300/40">— kg to goal</p>
                )}
                {(weightTarget !== null || eventDateFormatted || eventLocation) && (
                  <p className="text-[10px] text-purple-300/40 mt-0.5 leading-relaxed">
                    {[
                      weightTarget !== null ? `Target: ${weightTarget} kg` : null,
                      eventDateFormatted,
                      eventLocation,
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
            {totalDays !== null && (
              <Badge className="bg-purple-500/25 text-purple-200 border-purple-400/40 text-sm font-bold px-3 py-1.5">
                {progress}% done
              </Badge>
            )}
          </div>

          {/* Thicker progress bar with phase markers */}
          {totalDays !== null && (
          <div className="mt-4 mb-1">
            <div className="w-full bg-white/10 rounded-full h-2 relative">
              <div
                className="bg-gradient-to-r from-purple-500 via-violet-400 to-pink-400 h-2 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
              <div className="absolute inset-y-0 w-px bg-white/60" style={{ left: '33%' }} />
              <div className="absolute inset-y-0 w-px bg-white/60" style={{ left: '66%' }} />
            </div>
            <div className="relative mt-1" style={{ height: '14px' }}>
              <span className="absolute text-[10px] text-white/50" style={{ left: '0%' }}>P1</span>
              <span className="absolute text-[10px] text-white/50" style={{ left: '33%', transform: 'translateX(-50%)' }}>P2</span>
              <span className="absolute text-[10px] text-white/50" style={{ left: '66%', transform: 'translateX(-50%)' }}>P3</span>
            </div>
          </div>
          )}
        </div>
      </div>
      )}

      {/* AI Tip — today only */}
      {isToday && <AITipButton page="today" />}
    </div>
  )
}
