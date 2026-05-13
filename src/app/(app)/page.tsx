import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTodayContext, getUserGoals, getUserTraining } from '@/lib/db'
import { getDaysToEvent, getTrainingDayType, cn } from '@/lib/utils'
import { Zap, Footprints, Scale, ChevronRight, Music2, Dumbbell, Moon, Activity, UtensilsCrossed, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { QualitativeCheckin } from '@/components/qualitative-checkin'
import { DayNav } from '@/components/day-nav'

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

  const todayStr = new Date().toISOString().split('T')[0]
  const params = await searchParams
  const rawDate = params.date ?? todayStr
  // clamp to today — no future dates
  const date = rawDate > todayStr ? todayStr : rawDate
  const isToday = date === todayStr

  const [ctx, goals, training] = await Promise.all([
    getTodayContext(date),
    getUserGoals(),
    getUserTraining(),
  ])
  if (!ctx) redirect('/login')

  const eventDate = goals?.target_event_date ?? null
  const days = eventDate ? getDaysToEvent(date, eventDate) : null
  const todayType = getTrainingDayType(new Date(date + 'T12:00:00'), training?.training_split ?? {})
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
    ? 'connect Whoop'
    : recovery >= 67 ? '🟢 Green — train hard'
    : recovery >= 34 ? '🟡 Yellow — train smart'
    : '🔴 Red — rest or Zone 2'

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
    <div className="px-4 pt-14 pb-8 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-xs tracking-widest uppercase">
            {isToday ? getGreeting() : 'Past day'}
          </p>
          <DayNav date={date} todayStr={todayStr} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/week"
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Week view"
          >
            <CalendarDays size={16} />
          </Link>
          <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-sm font-bold text-orange-400">
            {initials}
          </div>
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
                <span className="text-[10px] font-bold text-zinc-800">{DAY_LETTERS[i]}</span>
                <span className="text-xs font-semibold text-zinc-800">{dayNum}</span>
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
                'text-[10px] font-bold',
                isSelected ? 'text-orange-400' : 'text-zinc-500'
              )}>
                {DAY_LETTERS[i]}
              </span>
              <span className={cn(
                'text-xs font-semibold',
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
            <Music2 size={12} className="text-purple-400" />
            <span className="text-purple-300 text-[10px] font-bold uppercase tracking-widest">{eventName ?? 'Target Event'}</span>
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
          <p className="text-zinc-600 text-xs">{[eventDateFormatted, eventLocation].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      )}

      {/* Today's session */}
      <Link
        href="/training"
        className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 hover:border-orange-500/20 transition-all duration-200"
      >
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Dumbbell size={20} className="text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            {isToday ? "Today's Session" : 'Session'}
          </p>
          <p className="text-white font-semibold text-base truncate">{todayType}</p>
          <p className="text-zinc-600 text-xs mt-0.5">
            {ctx.trainingSessions.length > 0
              ? `${ctx.trainingSessions.length} session${ctx.trainingSessions.length > 1 ? 's' : ''} logged`
              : isToday ? 'Tap to log session' : 'No session logged'}
          </p>
        </div>
        <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
      </Link>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Nutrition card */}
        <Link href="/food" className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-orange-500/20 transition-all duration-200 block">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-xs font-medium">Nutrition</span>
            <div className="w-7 h-7 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <UtensilsCrossed size={13} className="text-orange-400" />
            </div>
          </div>
          {hasMacros ? (
            <>
              <div className="flex items-baseline gap-1 flex-wrap">
                {protein !== null && (
                  <span className="font-condensed text-xl font-bold text-orange-300 leading-none">
                    {protein}<span className="text-xs font-normal text-zinc-500">P</span>
                  </span>
                )}
                {carbs !== null && (
                  <span className="font-condensed text-xl font-bold text-yellow-300 leading-none">
                    {protein !== null && <span className="text-zinc-700 font-normal mx-0.5">·</span>}
                    {carbs}<span className="text-xs font-normal text-zinc-500">C</span>
                  </span>
                )}
                {fats !== null && (
                  <span className="font-condensed text-xl font-bold text-blue-300 leading-none">
                    {(protein !== null || carbs !== null) && <span className="text-zinc-700 font-normal mx-0.5">·</span>}
                    {fats}<span className="text-xs font-normal text-zinc-500">F</span>
                  </span>
                )}
              </div>
              <p className="text-zinc-600 text-xs mt-1.5 leading-tight">
                {calories !== null ? `${calories.toLocaleString()} kcal total` : 'log calories'}
              </p>
            </>
          ) : calories !== null ? (
            <>
              <p className="font-condensed text-3xl font-bold leading-none text-orange-400">
                {calories.toLocaleString()}
              </p>
              <p className="text-zinc-600 text-xs mt-1.5 leading-tight">kcal · log macros</p>
            </>
          ) : (
            <>
              <p className="font-condensed text-3xl font-bold leading-none text-orange-400">—</p>
              <p className="text-zinc-600 text-xs mt-1.5 leading-tight">log food</p>
            </>
          )}
        </Link>

        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-white/10 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-500 text-xs font-medium">{label}</span>
              <div className={`w-7 h-7 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={13} className={color} />
              </div>
            </div>
            <p className={cn('font-condensed text-3xl font-bold leading-none', color)}>{value}</p>
            <p className="text-zinc-600 text-xs mt-1.5 leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      {/* WHOOP — Recovery vitals (when connected) */}
      {(ctx.recovery || ctx.cycle) && (
        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={13} className="text-violet-400" />
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Recovery Vitals</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ctx.recovery?.hrv_rmssd_milli !== null && ctx.recovery?.hrv_rmssd_milli !== undefined && (
              <div className="bg-violet-500/10 rounded-xl p-3">
                <p className="text-violet-400 font-bold text-2xl leading-none">{Math.round(ctx.recovery.hrv_rmssd_milli)}</p>
                <p className="text-zinc-600 text-[10px] mt-1 font-medium">HRV · ms</p>
              </div>
            )}
            {ctx.cycle?.strain !== null && ctx.cycle?.strain !== undefined && (
              <div className={cn('rounded-xl p-3',
                ctx.cycle.strain >= 18 ? 'bg-red-500/10' :
                ctx.cycle.strain >= 14 ? 'bg-orange-500/10' :
                ctx.cycle.strain >= 10 ? 'bg-yellow-500/10' : 'bg-green-500/10'
              )}>
                <p className={cn('font-bold text-2xl leading-none',
                  ctx.cycle.strain >= 18 ? 'text-red-400' :
                  ctx.cycle.strain >= 14 ? 'text-orange-400' :
                  ctx.cycle.strain >= 10 ? 'text-yellow-400' : 'text-green-400'
                )}>{ctx.cycle.strain.toFixed(1)}</p>
                <p className="text-zinc-600 text-[10px] mt-1 font-medium">Strain · /21</p>
              </div>
            )}
            {ctx.recovery?.resting_heart_rate !== null && ctx.recovery?.resting_heart_rate !== undefined && (
              <div className="bg-red-500/10 rounded-xl p-3">
                <p className="text-red-400 font-bold text-2xl leading-none">{ctx.recovery.resting_heart_rate}</p>
                <p className="text-zinc-600 text-[10px] mt-1 font-medium">RHR · bpm</p>
              </div>
            )}
            {ctx.recovery?.spo2_percentage !== null && ctx.recovery?.spo2_percentage !== undefined && (
              <div className="bg-sky-500/10 rounded-xl p-3">
                <p className="text-sky-400 font-bold text-2xl leading-none">{ctx.recovery.spo2_percentage}%</p>
                <p className="text-zinc-600 text-[10px] mt-1 font-medium">SpO₂</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sleep (when WHOOP connected) */}
      {ctx.sleep && (
        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Moon size={13} className="text-indigo-400" />
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Last Night's Sleep</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Duration', value: ctx.sleep.duration_hrs ? `${ctx.sleep.duration_hrs}h` : '—' },
              { label: 'Performance', value: ctx.sleep.sleep_performance_pct ? `${ctx.sleep.sleep_performance_pct}%` : '—' },
              { label: 'Deep', value: ctx.sleep.deep_sleep_min ? `${ctx.sleep.deep_sleep_min}m` : '—' },
              { label: 'REM', value: ctx.sleep.rem_min ? `${ctx.sleep.rem_min}m` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-white font-semibold text-lg leading-none">{value}</p>
                <p className="text-zinc-600 text-[10px] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualitative check-in (today only, when no WHOOP data) */}
      {isToday && !ctx.recovery && !ctx.sleep && !ctx.cycle && (
        <QualitativeCheckin
          initialRecovery={ctx.dailyLog?.feeling_recovery ?? null}
          initialSleepQuality={ctx.dailyLog?.feeling_sleep_quality ?? null}
          initialSleepHours={ctx.dailyLog?.feeling_sleep_hours ?? null}
          initialStrain={ctx.dailyLog?.feeling_strain ?? null}
        />
      )}

      {/* Supplements */}
      {suppTotal > 0 && (
        <Link href="/supplements" className="block bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-white/10 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Supplement Stack</span>
            <span className={cn('text-xs font-semibold', suppTaken === suppTotal && suppTotal > 0 ? 'text-green-400' : 'text-zinc-500')}>
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

      {/* AI Coach CTA — today only */}
      {isToday && (
        <Link
          href="/chat"
          className="flex items-center justify-between w-full bg-orange-500 text-black font-bold px-5 py-4 rounded-2xl active:scale-[0.98] transition-all duration-200 text-sm hover:bg-orange-400"
        >
          <span className="font-condensed text-base uppercase tracking-wide">Ask Your AI Coach</span>
          <ChevronRight size={18} />
        </Link>
      )}
    </div>
  )
}
