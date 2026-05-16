import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTodayContext, getUserGoals } from '@/lib/db'
import { getDaysToEvent, cn } from '@/lib/utils'
import { Zap, Footprints, Scale, Music2, Moon, Activity, UtensilsCrossed, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { QualitativeCheckin } from '@/components/qualitative-checkin'
import { DayNav } from '@/components/day-nav'
import { AITipButton } from '@/components/ai-tip-button'
import { AiBriefCard } from '@/components/ai-brief-card'
import { TodayWorkoutCard } from '@/components/training/TodayWorkoutCard'
import { UserMenu } from '@/components/user-menu'

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
  const params = await searchParams
  const rawDate = params.date ?? todayStr
  // clamp to today — no future dates
  const date = rawDate > todayStr ? todayStr : rawDate
  const isToday = date === todayStr

  const [ctx, goals] = await Promise.all([
    getTodayContext(date),
    getUserGoals(),
  ])
  if (!ctx) redirect('/login')

  const eventDate = goals?.target_event_date ?? null
  const days = eventDate ? getDaysToEvent(date, eventDate) : null
  const stepsTarget = goals?.daily_steps_target ?? 10000
  const weightTarget = goals?.target_weight_kg ?? null
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
  const protein = ctx.dailyLog?.protein_g ?? null
  const carbs = ctx.dailyLog?.carbs_g ?? null
  const fats = ctx.dailyLog?.fats_g ?? null
  const calories = ctx.dailyLog?.calories ?? null
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
    },
    {
      label: 'Steps',
      value: steps !== null ? steps.toLocaleString() : '—',
      sub: steps !== null ? `${Math.round((steps / stepsTarget) * 100)}% of ${stepsTarget.toLocaleString()}` : `target ${stepsTarget.toLocaleString()}`,
      icon: Footprints,
      color: steps === null ? 'text-blue-400' : steps >= stepsTarget ? 'text-green-400' : 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Weight',
      value: weight !== null ? `${weight}kg` : '—',
      sub: weightTarget !== null ? `target ${weightTarget}kg` : 'log weight',
      icon: Scale,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
  ]

  // Build week strip data
  const weekDays = getWeekDays(date)
  const recoveryByDate = Object.fromEntries(
    ctx.recentRecovery.map(r => [r.date, r.recovery_score])
  )

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-sm tracking-widest uppercase">
            {isToday ? getGreeting() : 'Past day'}
          </p>
          <DayNav date={date} todayStr={todayStr} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/week"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
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
          const isSelected = d === date
          const score = recoveryByDate[d] ?? null
          const dotColor = score === null
            ? 'bg-zinc-700'
            : score >= 67 ? 'bg-green-400'
            : score >= 34 ? 'bg-yellow-400'
            : 'bg-red-400'
          const dayNum = new Date(d + 'T12:00:00').getDate()

          if (isFuture) {
            return (
              <div
                key={d}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl"
              >
                <span className="text-xs font-bold text-zinc-800">{DAY_LETTERS[i]}</span>
                <span className="text-sm font-semibold text-zinc-800">{dayNum}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
              </div>
            )
          }

          return (
            <Link
              key={d}
              href={d === todayStr ? '/' : `/?date=${d}`}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all duration-150',
                isSelected
                  ? 'bg-orange-500/15 border border-orange-500/30'
                  : 'hover:bg-white/5'
              )}
            >
              <span className={cn(
                'text-xs font-bold',
                isSelected ? 'text-orange-400' : 'text-zinc-500'
              )}>
                {DAY_LETTERS[i]}
              </span>
              <span className={cn(
                'text-sm font-semibold',
                isSelected ? 'text-white' : 'text-zinc-400'
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
              <span className="text-zinc-400 text-sm mb-2">days to go</span>
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
          <p className="text-zinc-600 text-sm">{[eventDateFormatted, eventLocation].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      )}

      {/* AI Daily Brief — today only */}
      {isToday && <AiBriefCard />}

      {/* Today's session */}
      <TodayWorkoutCard isToday={isToday} date={date} />

      {/* Stats */}
      <div className="space-y-3">
        {/* Nutrition — full width */}
        <Link href="/food" className="bg-card border border-border rounded-2xl p-5 hover:border-orange-500/25 transition-all duration-200 block">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-sm font-medium">Nutrition</span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <UtensilsCrossed size={16} className="text-orange-400" />
            </div>
          </div>
          {hasMacros ? (
            <div className="flex items-baseline gap-3">
              {protein !== null && (
                <span className="font-condensed text-2xl font-bold text-orange-300 leading-none">
                  {protein}<span className="text-xs font-normal text-zinc-500 ml-0.5">P</span>
                </span>
              )}
              {carbs !== null && (
                <span className="font-condensed text-2xl font-bold text-yellow-300 leading-none">
                  {carbs}<span className="text-xs font-normal text-zinc-500 ml-0.5">C</span>
                </span>
              )}
              {fats !== null && (
                <span className="font-condensed text-2xl font-bold text-blue-300 leading-none">
                  {fats}<span className="text-xs font-normal text-zinc-500 ml-0.5">F</span>
                </span>
              )}
              {calories !== null && (
                <span className="text-zinc-600 text-xs ml-auto">{calories.toLocaleString()} kcal</span>
              )}
            </div>
          ) : calories !== null ? (
            <div className="flex items-baseline gap-2">
              <p className="font-condensed text-3xl font-bold leading-none text-orange-400">
                {calories.toLocaleString()}
              </p>
              <p className="text-zinc-600 text-xs">kcal · log macros</p>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="font-condensed text-3xl font-bold leading-none text-orange-400">—</p>
              <p className="text-zinc-600 text-xs">tap to log food</p>
            </div>
          )}
        </Link>

        {/* Recovery · Steps · Weight — 3-col row */}
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-5 transition-all duration-200">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon size={16} className={color} />
              </div>
              <p className={cn('font-condensed text-3xl font-bold leading-none', color)}>{value}</p>
              <p className="text-zinc-600 text-xs mt-2 leading-tight">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* WHOOP — Recovery vitals (when connected) */}
      {(ctx.recovery || ctx.cycle) && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-violet-400" />
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Recovery Vitals</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {ctx.recovery?.hrv_rmssd_milli !== null && ctx.recovery?.hrv_rmssd_milli !== undefined && (
              <div>
                <p className="text-violet-400 font-bold text-3xl leading-none">{Math.round(ctx.recovery.hrv_rmssd_milli)}</p>
                <p className="text-zinc-600 text-xs mt-1.5">HRV · ms</p>
              </div>
            )}
            {ctx.cycle?.strain !== null && ctx.cycle?.strain !== undefined && (
              <div>
                <p className={cn('font-bold text-3xl leading-none',
                  ctx.cycle.strain >= 18 ? 'text-red-400' :
                  ctx.cycle.strain >= 14 ? 'text-orange-400' :
                  ctx.cycle.strain >= 10 ? 'text-yellow-400' : 'text-green-400'
                )}>{ctx.cycle.strain.toFixed(1)}</p>
                <p className="text-zinc-600 text-xs mt-1.5">Strain · /21</p>
              </div>
            )}
            {ctx.recovery?.resting_heart_rate !== null && ctx.recovery?.resting_heart_rate !== undefined && (
              <div>
                <p className="text-red-400 font-bold text-3xl leading-none">{ctx.recovery.resting_heart_rate}</p>
                <p className="text-zinc-600 text-xs mt-1.5">RHR · bpm</p>
              </div>
            )}
            {ctx.recovery?.spo2_percentage !== null && ctx.recovery?.spo2_percentage !== undefined && (
              <div>
                <p className="text-sky-400 font-bold text-3xl leading-none">{parseFloat(String(ctx.recovery.spo2_percentage)).toFixed(1)}%</p>
                <p className="text-zinc-600 text-xs mt-1.5">SpO₂</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sleep (when WHOOP connected) */}
      {showSleep && ctx.sleep && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Moon size={15} className="text-indigo-400" />
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Last Night&apos;s Sleep</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Duration', value: ctx.sleep.duration_hrs ? `${ctx.sleep.duration_hrs}h` : '—' },
              { label: 'Performance', value: ctx.sleep.sleep_performance_pct ? `${ctx.sleep.sleep_performance_pct}%` : '—' },
              { label: 'Deep', value: ctx.sleep.deep_sleep_min ? `${ctx.sleep.deep_sleep_min}m` : '—' },
              { label: 'REM', value: ctx.sleep.rem_min ? `${ctx.sleep.rem_min}m` : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-foreground font-bold text-xl leading-none">{value}</p>
                <p className="text-zinc-600 text-xs mt-1.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <Link href={`/supplements?date=${date}`} className="block bg-card border border-border rounded-2xl p-5 hover:border-white/15 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Supplement Stack</span>
            <span className={cn('text-sm font-semibold', suppTaken === suppTotal && suppTotal > 0 ? 'text-green-400' : 'text-zinc-500')}>
              {suppTaken}/{suppTotal} taken
            </span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 mb-3">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all duration-500',
                suppTaken === suppTotal && suppTotal > 0 ? 'bg-green-400' : 'bg-violet-500',
              )}
              style={{ width: suppTotal > 0 ? `${Math.round((suppTaken / suppTotal) * 100)}%` : '0%' }}
            />
          </div>
          <div className="space-y-2">
            {ctx.supplements.slice(0, 4).map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className={cn('text-sm truncate pr-2', s.taken ? 'text-zinc-600 line-through' : 'text-zinc-300')}>
                  {s.supplement_name}
                </span>
                <div className={cn(
                  'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold',
                  s.taken ? 'bg-green-500 text-black' : 'bg-white/5 border border-white/10 text-transparent',
                )}>
                  ✓
                </div>
              </div>
            ))}
            {ctx.supplements.length > 4 && (
              <p className="text-zinc-600 text-xs">+{ctx.supplements.length - 4} more · tap to manage</p>
            )}
          </div>
        </Link>
      )}

      {/* AI Tip — today only */}
      {isToday && <AITipButton page="today" />}
    </div>
  )
}
