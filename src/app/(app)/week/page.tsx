import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getRecentDailyLogs,
  getRecentRecovery,
  getRecentTraining,
  getRecentSleep,
  getUserTraining,
} from '@/lib/db'
import { getTrainingDayType, cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Zap, Dumbbell, UtensilsCrossed, Moon } from 'lucide-react'

export const dynamic = 'force-dynamic'

const DAY_LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

function formatWeekRange(weekDays: string[]): string {
  const first = new Date(weekDays[0] + 'T12:00:00')
  const last = new Date(weekDays[6] + 'T12:00:00')
  const firstStr = first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const lastStr = last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${firstStr} – ${lastStr}`
}

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayStr = new Date().toISOString().split('T')[0]
  const params = await searchParams
  const anchorDate = params.date ?? todayStr

  const weekDays = getWeekDays(anchorDate)
  const weekStart = weekDays[0]

  // Previous / next week anchor dates
  const prevWeekAnchor = (() => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })()
  const nextWeekAnchor = (() => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()
  const isCurrentWeek = weekDays.includes(todayStr)
  const isFutureWeek = weekStart > todayStr

  const [dailyLogs, recentRecovery, recentTraining, recentSleep, userTraining] = await Promise.all([
    getRecentDailyLogs(30),
    getRecentRecovery(30),
    getRecentTraining(30),
    getRecentSleep(30),
    getUserTraining(),
  ])

  const trainingSplit: Record<string, string> = userTraining?.training_split ?? {}

  const logByDate = Object.fromEntries(dailyLogs.map(l => [l.date, l]))
  const recoveryByDate = Object.fromEntries(recentRecovery.map(r => [r.date, r]))
  const trainingByDate: Record<string, number> = {}
  for (const t of recentTraining) {
    trainingByDate[t.date] = (trainingByDate[t.date] ?? 0) + 1
  }
  const sleepByDate = Object.fromEntries(recentSleep.map(s => [s.date, s]))

  // Weekly aggregates
  const weekLogs = weekDays.map(d => logByDate[d]).filter(Boolean)
  const weekRecovery = weekDays.map(d => recoveryByDate[d]).filter(Boolean)
  const avgRecovery = weekRecovery.length
    ? Math.round(weekRecovery.reduce((a, r) => a + (r.recovery_score ?? 0), 0) / weekRecovery.length)
    : null
  const totalSessions = weekDays.reduce((a, d) => a + (trainingByDate[d] ?? 0), 0)
  const avgCalories = weekLogs.filter(l => l.calories).length
    ? Math.round(weekLogs.filter(l => l.calories).reduce((a, l) => a + (l.calories ?? 0), 0) / weekLogs.filter(l => l.calories).length)
    : null
  const avgSleep = weekDays.map(d => sleepByDate[d]).filter(Boolean)
  const avgSleepHrs = avgSleep.length
    ? (avgSleep.reduce((a, s) => a + (s.duration_hrs ?? 0), 0) / avgSleep.length).toFixed(1)
    : null

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Week view</p>
            <p className="text-foreground font-semibold text-sm">{formatWeekRange(weekDays)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/week?date=${prevWeekAnchor}`}
            className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={isFutureWeek ? '#' : `/week?date=${nextWeekAnchor}`}
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
              isCurrentWeek
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground bg-muted/50 hover:text-foreground hover:bg-muted'
            )}
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* Weekly summary row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: 'Avg Recovery',
            value: avgRecovery !== null ? `${avgRecovery}%` : '—',
            icon: Zap,
            color: avgRecovery === null ? 'text-muted-foreground' : avgRecovery >= 67 ? 'text-green-400' : avgRecovery >= 34 ? 'text-yellow-400' : 'text-red-400',
          },
          {
            label: 'Sessions',
            value: String(totalSessions),
            icon: Dumbbell,
            color: totalSessions > 0 ? 'text-orange-400' : 'text-muted-foreground',
          },
          {
            label: 'Avg kcal',
            value: avgCalories !== null ? `${avgCalories.toLocaleString()}` : '—',
            icon: UtensilsCrossed,
            color: avgCalories !== null ? 'text-orange-300' : 'text-muted-foreground',
          },
          {
            label: 'Avg Sleep',
            value: avgSleepHrs !== null ? `${avgSleepHrs}h` : '—',
            icon: Moon,
            color: avgSleepHrs !== null ? 'text-indigo-400' : 'text-muted-foreground',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-1.5">
            <Icon size={13} className={color} />
            <p className={cn('font-condensed text-xl font-bold leading-none', color)}>{value}</p>
            <p className="text-muted-foreground/60 text-[9px] font-medium text-center leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {weekDays.map((d, i) => {
          const isFuture = d > todayStr
          const isToday = d === todayStr
          const log = logByDate[d]
          const rec = recoveryByDate[d]
          const sessions = trainingByDate[d] ?? 0
          const sleep = sleepByDate[d]
          const dayLabel = DAY_LETTERS[i]
          const dayNum = new Date(d + 'T12:00:00').getDate()
          const trainingType = getTrainingDayType(new Date(d + 'T12:00:00'), trainingSplit)

          const recColor = rec === null || rec === undefined
            ? 'text-zinc-600'
            : rec.recovery_score === null ? 'text-zinc-600'
            : rec.recovery_score >= 67 ? 'text-green-400'
            : rec.recovery_score >= 34 ? 'text-yellow-400'
            : 'text-red-400'

          const recBg = rec === null || rec === undefined
            ? 'bg-muted/50'
            : rec.recovery_score === null ? 'bg-zinc-800/50'
            : rec.recovery_score >= 67 ? 'bg-green-500/10'
            : rec.recovery_score >= 34 ? 'bg-yellow-500/10'
            : 'bg-red-500/10'

          return (
            <Link
              key={d}
              href={isFuture ? '#' : isToday ? '/' : `/?date=${d}`}
              className={cn(
                'block rounded-2xl border transition-all duration-150',
                isFuture
                  ? 'border-border/30 bg-card/40 cursor-not-allowed opacity-40'
                  : isToday
                  ? 'border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10'
                  : 'border-border bg-card hover:border-border/80'
              )}
            >
              <div className="p-5 flex items-center gap-4">
                {/* Date column */}
                <div className="flex flex-col items-center min-w-[36px]">
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    isToday ? 'text-orange-400' : 'text-muted-foreground'
                  )}>
                    {dayLabel}
                  </span>
                  <span className={cn(
                    'font-condensed text-2xl font-bold leading-none',
                    isToday ? 'text-orange-400' : isFuture ? 'text-muted-foreground/40' : 'text-foreground'
                  )}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1" />
                  )}
                </div>

                {/* Recovery badge */}
                <div className={cn('rounded-xl px-2.5 py-2 flex flex-col items-center min-w-[48px]', recBg)}>
                  <span className={cn('font-bold text-lg leading-none', recColor)}>
                    {rec?.recovery_score !== null && rec?.recovery_score !== undefined ? `${rec.recovery_score}` : '—'}
                  </span>
                  <span className="text-muted-foreground/60 text-[9px] mt-0.5 font-medium">REC%</span>
                </div>

                {/* Middle — training type + metrics */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-medium truncate',
                    isFuture ? 'text-muted-foreground/40' : 'text-muted-foreground'
                  )}>
                    {trainingType}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {sessions > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-orange-400 font-medium">
                        <Dumbbell size={10} />
                        {sessions} session{sessions > 1 ? 's' : ''}
                      </span>
                    )}
                    {log?.calories && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {log.calories.toLocaleString()} kcal
                      </span>
                    )}
                    {log?.steps && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {log.steps.toLocaleString()} steps
                      </span>
                    )}
                    {sleep?.duration_hrs && (
                      <span className="flex items-center gap-1 text-[10px] text-indigo-400">
                        <Moon size={9} />
                        {sleep.duration_hrs}h
                      </span>
                    )}
                    {!sessions && !log?.calories && !log?.steps && !sleep?.duration_hrs && !isFuture && (
                      <span className="text-[10px] text-muted-foreground/40">No data logged</span>
                    )}
                  </div>
                </div>

                {!isFuture && (
                  <ChevronRight size={14} className="text-muted-foreground/40 flex-shrink-0" />
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
