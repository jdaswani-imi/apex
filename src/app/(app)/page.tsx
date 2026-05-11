import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTodayContext } from '@/lib/db'
import { getDaysToTomorrowland, getTrainingDayType, cn } from '@/lib/utils'
import { Flame, Zap, Footprints, Scale, ChevronRight, Music2, Dumbbell, Moon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getTodayContext()
  if (!ctx) redirect('/login')

  const days = getDaysToTomorrowland()
  const todayType = getTrainingDayType(new Date())
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const totalDays = 79
  const progress = Math.min(100, Math.round(((totalDays - days) / totalDays) * 100))
  const initials = (user.email ?? 'J').slice(0, 1).toUpperCase()

  const recovery = ctx.recovery?.recovery_score ?? null
  const protein = ctx.dailyLog?.protein_g ?? null
  const calories = ctx.dailyLog?.calories ?? null
  const steps = ctx.dailyLog?.steps ?? null
  const weight = ctx.dailyLog?.weight_kg
    ?? ctx.recentLogs.find(l => l.weight_kg !== null)?.weight_kg
    ?? null

  const recoveryLabel = recovery === null
    ? 'connect Whoop'
    : recovery >= 67 ? '🟢 Green — train hard'
    : recovery >= 34 ? '🟡 Yellow — train smart'
    : '🔴 Red — rest or Zone 2'

  const suppTaken = ctx.supplements.filter(s => s.taken).length
  const suppTotal = ctx.supplements.length

  const stats = [
    {
      label: 'Protein',
      value: protein !== null ? `${protein}g` : '—',
      sub: protein !== null ? `${Math.round((protein / 140) * 100)}% of 140g` : 'target 140g',
      icon: Flame,
      color: protein === null ? 'text-orange-400' : protein >= 140 ? 'text-green-400' : protein >= 100 ? 'text-yellow-400' : 'text-red-400',
      bg: 'bg-orange-500/10',
    },
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
      sub: steps !== null ? `${Math.round((steps / 10000) * 100)}% of 10k` : 'target 10,000',
      icon: Footprints,
      color: steps === null ? 'text-blue-400' : steps >= 10000 ? 'text-green-400' : 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Weight',
      value: weight !== null ? `${weight}kg` : '—',
      sub: 'target 65kg',
      icon: Scale,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
  ]

  return (
    <div className="px-4 pt-14 pb-8 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-xs tracking-widest uppercase">{today}</p>
          <h1 className="font-condensed text-3xl font-bold text-white mt-0.5 tracking-wide uppercase">
            {getGreeting()}
          </h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-sm font-bold text-orange-400">
          {initials}
        </div>
      </div>

      {/* Tomorrowland */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/90 via-violet-900/50 to-pink-950/70 p-5">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-2">
            <Music2 size={12} className="text-purple-400" />
            <span className="text-purple-300 text-[10px] font-bold uppercase tracking-widest">Tomorrowland</span>
          </div>
          <div className="flex items-end justify-between mb-3">
            <div className="flex items-end gap-2">
              <span className="font-condensed text-7xl font-bold text-white leading-none">{days}</span>
              <span className="text-zinc-400 text-sm mb-2">days to go</span>
            </div>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
              {progress}% done
            </Badge>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-1.5">
            <div
              className="bg-gradient-to-r from-purple-500 via-violet-400 to-pink-400 h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-zinc-600 text-xs">24 July 2026 · Boom, Belgium</p>
        </div>
      </div>

      {/* Today's session */}
      <Link
        href="/training"
        className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 hover:border-orange-500/20 transition-all duration-200"
      >
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Dumbbell size={20} className="text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">Today's Session</p>
          <p className="text-white font-semibold text-base truncate">{todayType}</p>
          <p className="text-zinc-600 text-xs mt-0.5">
            {ctx.trainingSessions.length > 0
              ? `${ctx.trainingSessions.length} session${ctx.trainingSessions.length > 1 ? 's' : ''} logged`
              : 'Tap to log session'}
          </p>
        </div>
        <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
      </Link>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Sleep */}
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

      {/* Supplements */}
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

      {/* AI Coach CTA */}
      <Link
        href="/chat"
        className="flex items-center justify-between w-full bg-orange-500 text-black font-bold px-5 py-4 rounded-2xl active:scale-[0.98] transition-all duration-200 text-sm hover:bg-orange-400"
      >
        <span className="font-condensed text-base uppercase tracking-wide">Ask Your AI Coach</span>
        <ChevronRight size={18} />
      </Link>
    </div>
  )
}
