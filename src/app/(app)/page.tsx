import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTodayContext, getUserGoals } from '@/lib/db'
import { getDaysToEvent, cn } from '@/lib/utils'
import { Zap, Footprints, Scale, Music2, Moon, Activity, UtensilsCrossed, CalendarDays, Info } from 'lucide-react'
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

  const todayStr = new Date().toISOString().split('T')[0]
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

  const hasMacros = protein !== null || carbs !== null || fats !== null

  const recoveryLabel = recovery === null
    ? 'Connect WHOOP'
    : recovery >= 67 ? 'Green · push hard today'
    : recovery >= 34 ? 'Yellow · train smart'
    : 'Red · rest or Zone 2'

  const sortedSupplements = [...ctx.supplements].sort((a, b) => {
    const aEntry = SUPPLEMENT_CATALOG.find(e => e.name === a.supplement_name)
    const bEntry = SUPPLEMENT_CATALOG.find(e => e.name === b.supplement_name)
    return (aEntry?.sortOrder ?? 999) - (bEntry?.sortOrder ?? 999)
  })

  const suppTaken = ctx.supplements.filter(s => s.taken).length
  const suppTotal = ctx.supplements.length

  const stats = [
    {
      label: 'Recovery',
      value: recovery !== null ? `${recovery}%` : '—',
      sub: recoveryLabel,
      icon: Zap,
      color: recovery === null ? 'text-yellow-400' : recovery >= 67 ? 'text-green-400' : recovery >= 34 ? 'text-yellow-400' : 'text-red-400',
      bg: 'bg-yellow-500/10',
      href: '/sleep',
    },
    {
      label: 'Steps',
      value: steps !== null ? steps.toLocaleString() : '—',
      sub: steps !== null ? `${Math.round((steps / stepsTarget) * 100)}% of ${stepsTarget.toLocaleString()}` : `target ${stepsTarget.toLocaleString()}`,
      icon: Footprints,
      color: steps === null ? 'text-blue-400' : steps >= stepsTarget ? 'text-green-400' : 'text-blue-400',
      bg: 'bg-blue-500/10',
      href: '/week',
    },
    {
      label: 'Weight',
      value: weight !== null ? `${weight}kg` : '—',
      sub: weightTarget !== null ? `target ${weightTarget}kg` : 'log weight',
      icon: Scale,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      href: '/progress',
    },
  ]

  // Build week strip data
  const weekDays = getWeekDays(date)
  const recoveryByDate = Object.fromEntries(
    ctx.recentRecovery.map(r => [r.date, r.recovery_score])
  )

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8 space-y-4">
      <WhoopAutoSync />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm tracking-widest uppercase">
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
          const score = recoveryByDate[d] ?? null
          const dotColor = score === null
            ? isFuture ? 'bg-muted/50' : 'bg-muted-foreground/30'
            : score >= 67 ? 'bg-green-400'
            : score >= 34 ? 'bg-yellow-400'
            : 'bg-red-400'
          const dayNum = new Date(d + 'T12:00:00').getDate()

          if (isBeyondMax) {
            return (
              <div
                key={d}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl"
              >
                <span className="text-xs font-bold text-muted-foreground/25">{DAY_LETTERS[i]}</span>
                <span className="text-sm font-semibold text-muted-foreground/25">{dayNum}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
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
                'text-xs font-bold',
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
              <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
            </Link>
          )
        })}
      </div>

      {/* Target event */}
      {eventDate && days !== null && (
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/90 via-violet-900/50 to-pink-950/70 p-5">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-2">
            <Music2 size={14} className="text-purple-400" />
            <span className="text-purple-300 text-xs font-bold uppercase tracking-widest">{eventName ?? 'Target Event'}</span>
          </div>
          <div className="flex items-end justify-between mb-3">
            <div className="flex items-end gap-2">
              <span className="font-condensed text-7xl font-bold text-white leading-none">{days}</span>
              <span className="text-muted-foreground text-sm mb-2">days to go</span>
            </div>
            {totalDays !== null && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                {progress}% done
              </Badge>
            )}
          </div>
          {totalDays !== null && (
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-1.5">
            <div
              className="bg-gradient-to-r from-purple-500 via-violet-400 to-pink-400 h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          )}
          <p className="text-muted-foreground text-sm">{[eventDateFormatted, eventLocation].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      )}

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
        <Link href="/food" className="bg-card border border-border rounded-2xl p-4 hover:border-orange-500/25 transition-all duration-200 block">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Nutrition</span>
            <div className="flex items-center gap-2">
              {calories !== null && calorieTarget !== null && (
                <span className="text-[10px] text-muted-foreground font-medium">{calories.toLocaleString()} / {calorieTarget.toLocaleString()} kcal</span>
              )}
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <UtensilsCrossed size={14} className="text-orange-400" />
              </div>
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
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div
                      className={cn('h-1 rounded-full transition-all duration-500', calories >= calorieTarget ? 'bg-green-400' : 'bg-orange-500/60')}
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
          <Link href={stats[1].href} className="bg-card border border-border rounded-2xl p-4 transition-all duration-200 hover:border-white/15 block">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Steps</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Footprints size={14} className={stats[1].color} />
              </div>
            </div>
            <p className={cn('font-condensed text-3xl font-bold leading-none', stats[1].color)}>{stats[1].value}</p>
            {steps !== null && (
              <div className="mt-2">
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div
                    className={cn('h-1 rounded-full transition-all duration-500', steps >= stepsTarget ? 'bg-green-400' : 'bg-blue-400')}
                    style={{ width: `${Math.min(100, Math.round((steps / stepsTarget) * 100))}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-[10px] mt-1.5">{Math.round((steps / stepsTarget) * 100)}% of {stepsTarget.toLocaleString()}</p>
              </div>
            )}
            {steps === null && <p className="text-muted-foreground text-xs mt-2">target {stepsTarget.toLocaleString()}</p>}
          </Link>
          {/* Weight */}
          <Link href={stats[2].href} className="bg-card border border-border rounded-2xl p-4 transition-all duration-200 hover:border-white/15 block">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Weight</span>
              <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Scale size={14} className="text-green-400" />
              </div>
            </div>
            <p className="font-condensed text-3xl font-bold leading-none text-green-400">{stats[2].value}</p>
            <p className="text-muted-foreground text-xs mt-2 leading-tight">{stats[2].sub}</p>
          </Link>
        </div>

      </div>{/* end left col */}
      <div className="space-y-3">

        {/* WHOOP Recovery — score + vitals merged into one card */}
        {(ctx.recovery || ctx.cycle) ? (
          <Link href="/sleep" className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/20 transition-all duration-200">
            {/* Card header: label + recovery score */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-primary" />
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Recovery</span>
              </div>
              {recovery !== null && (
                <div className="flex items-center gap-2">
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
                </div>
              )}
            </div>
            {/* Vitals grid */}
            <div className="grid grid-cols-4 gap-3">
              {ctx.recovery?.hrv_rmssd_milli !== null && ctx.recovery?.hrv_rmssd_milli !== undefined && (
                <div>
                  <p className="text-foreground font-bold text-2xl leading-none">{Math.round(ctx.recovery.hrv_rmssd_milli)}</p>
                  <p className="text-muted-foreground text-[10px] mt-1.5 font-medium">HRV ms</p>
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
                  <p className="text-sky-400 font-bold text-2xl leading-none">{parseFloat(String(ctx.recovery.spo2_percentage)).toFixed(1)}%</p>
                  <p className="text-muted-foreground text-[10px] mt-1.5 font-medium">SpO₂</p>
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
          <Link href="/sleep" className="bg-card border border-border rounded-2xl p-4 hover:border-white/15 transition-all duration-200 block">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Recovery</span>
              <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Zap size={14} className="text-yellow-400" />
              </div>
            </div>
            <p className="font-condensed text-3xl font-bold leading-none text-muted-foreground/50">—</p>
            <p className="text-muted-foreground text-xs mt-2">Connect WHOOP to track</p>
          </Link>
        )}

        {/* Sleep — last night summary */}
        {showSleep && ctx.sleep && (
          <Link href="/sleep" className="bg-card border border-border rounded-2xl p-4 hover:border-white/15 transition-all duration-200 block">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Moon size={14} className="text-blue-400" />
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Last Night&apos;s Sleep</span>
              </div>
              {ctx.sleep.sleep_performance_pct && (
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  ctx.sleep.sleep_performance_pct >= 70 ? 'bg-emerald-500/15 text-emerald-400' :
                  ctx.sleep.sleep_performance_pct >= 50 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
                )}>{ctx.sleep.sleep_performance_pct}%</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Duration', value: ctx.sleep.duration_hrs ? `${ctx.sleep.duration_hrs}h` : '—', hint: 'aim 8h' },
                { label: 'Perf', value: ctx.sleep.sleep_performance_pct ? `${ctx.sleep.sleep_performance_pct}%` : '—', hint: '>85%' },
                { label: 'Deep', value: ctx.sleep.deep_sleep_min ? `${ctx.sleep.deep_sleep_min}m` : '—', hint: '>20%' },
                { label: 'REM', value: ctx.sleep.rem_min ? `${ctx.sleep.rem_min}m` : '—', hint: '>20%' },
              ].map(({ label, value, hint }) => (
                <div key={label}>
                  <p className="text-foreground font-bold text-xl leading-none">{value}</p>
                  <p className="text-muted-foreground text-[10px] mt-1 font-medium">{label}</p>
                  <p className="text-muted-foreground/40 text-[9px] mt-0.5">{hint}</p>
                </div>
              ))}
            </div>
          </Link>
        )}

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
        <DashboardSupplementStack initialSupplements={sortedSupplements} date={date} />
      )}

      {/* AI Tip — today only */}
      {isToday && <AITipButton page="today" />}
    </div>
  )
}
