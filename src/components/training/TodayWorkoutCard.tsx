'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Play, ChevronRight, Moon, CheckCircle2, Loader2, CalendarClock } from 'lucide-react'

interface TodayTemplate {
  id: string
  name: string
  description: string
  color: string
  exerciseCount: number
}

interface TodayData {
  isRest: boolean
  template: TodayTemplate | null
  sessionType: string
  sessionLogged: boolean
  sessionDone: boolean
  alternativeSession: string | null
}

interface NextWorkout {
  daysAway: number
  date: string
  dayLabel: string
  template: TodayTemplate | null
  sessionType: string
}

interface Props {
  isToday: boolean
  date: string
}

export function TodayWorkoutCard({ isToday, date }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TodayData | null>(null)
  const [next, setNext] = useState<NextWorkout | null | undefined>(undefined)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    setData(null)
    setNext(undefined)
    fetch(`/api/training/today-template?date=${date}`)
      .then(r => r.json())
      .then((d: TodayData) => {
        setData(d)
        if (d.isRest || d.sessionDone) {
          fetch(`/api/training/next-workout?after=${date}`)
            .then(r => r.json())
            .then(setNext)
            .catch(() => setNext(null))
        }
      })
      .catch(() => setData(null))
  }, [date])

  async function handleStart() {
    if (!data?.template || starting) return
    const { template } = data
    setStarting(true)
    try {
      const res = await fetch('/api/training/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          session_type: template.name.toLowerCase().replace(/\s+/g, '_'),
          template_id: template.id,
          started_at: new Date().toISOString(),
        }),
      })
      const session = await res.json()
      const params = new URLSearchParams({
        sessionId: session.id,
        templateId: template.id,
        templateName: template.name,
        color: template.color,
      })
      router.push(`/training?${params.toString()}`)
    } catch {
      setStarting(false)
    }
  }

  // Loading skeleton
  if (!data) {
    return (
      <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2 bg-zinc-800 rounded w-20" />
          <div className="h-4 bg-zinc-800 rounded w-32" />
          <div className="h-2 bg-zinc-800 rounded w-24" />
        </div>
      </div>
    )
  }

  const { isRest, template, sessionType, sessionLogged, sessionDone, alternativeSession } = data

  // Next workout inline badge (shown on rest/done cards)
  function NextBadge() {
    if (next === undefined) return null
    if (!next) return null
    const t = next.template
    const label = t ? t.name : next.sessionType
    const exStr = t?.exerciseCount ? ` · ${t.exerciseCount} ex` : ''
    return (
      <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-2">
        <CalendarClock size={12} className="text-zinc-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-zinc-400 text-xs font-semibold">{next.dayLabel}</span>
          <span className="text-zinc-600 text-xs"> — {label}{exStr}</span>
        </div>
        {t && (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
        )}
      </div>
    )
  }

  // Rest day
  if (isRest) {
    return (
      <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Moon size={20} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {isToday ? "Today's Session" : 'Session'}
            </p>
            <p className="text-white font-semibold text-base">Rest Day</p>
            <p className="text-zinc-600 text-xs mt-0.5">Recovery · light activity encouraged</p>
          </div>
        </div>
        <NextBadge />
      </div>
    )
  }

  // No template — show completed or generic link
  if (!template) {
    if (sessionDone) {
      const displayName = alternativeSession
        ? alternativeSession.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : sessionType
      return (
        <a
          href="/training"
          className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-green-500/20 transition-all duration-200 no-underline block"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={20} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                {isToday ? "Today's Session" : 'Session'}
              </p>
              <p className="text-white font-semibold text-base truncate">{displayName}</p>
              <p className="text-green-500 text-xs mt-0.5 font-medium">Nice work — training done for today</p>
            </div>
            <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
          </div>
          <NextBadge />
        </a>
      )
    }
    return (
      <a
        href="/training"
        className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 hover:border-orange-500/20 transition-all duration-200 no-underline block"
      >
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Dumbbell size={20} className="text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            {isToday ? "Today's Session" : 'Session'}
          </p>
          <p className="text-white font-semibold text-base truncate">{sessionType}</p>
          <p className="text-zinc-600 text-xs mt-0.5">
            {isToday ? 'Tap to log session' : 'No session logged'}
          </p>
        </div>
        <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
      </a>
    )
  }

  // Completed (template match or alternative session)
  if (sessionDone) {
    const isAlternative = !!alternativeSession
    const displayName = isAlternative
      ? alternativeSession!.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : template.name
    const subtext = isAlternative
      ? 'Nice work — training done for today'
      : 'Completed · great work'

    return (
      <a
        href="/training"
        className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-green-500/20 transition-all duration-200 no-underline block"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {isToday ? "Today's Session" : 'Session'}
            </p>
            <p className="text-white font-semibold text-base truncate">{displayName}</p>
            <p className="text-green-500 text-xs mt-0.5 font-medium">{subtext}</p>
          </div>
          <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
        </div>
        <NextBadge />
      </a>
    )
  }

  // Ready to start — expanded CTA
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{ border: `1px solid ${template.color}33`, backgroundColor: '#0f0f0f' }}
    >
      {/* Top accent stripe */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${template.color}cc, ${template.color}22)` }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${template.color}18`, border: `1px solid ${template.color}30` }}
          >
            <Dumbbell size={20} style={{ color: template.color }} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {isToday ? "Today's Session" : 'Session'}
            </p>
            <p className="text-white font-semibold text-base leading-tight truncate">{template.name}</p>
            {template.description && (
              <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{template.description}</p>
            )}
          </div>
          {template.exerciseCount > 0 && (
            <div
              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold mt-0.5"
              style={{ backgroundColor: `${template.color}18`, color: template.color }}
            >
              {template.exerciseCount} ex
            </div>
          )}
        </div>

        {/* Start button — full width, prominent */}
        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-60 active:scale-[0.98]"
          style={{ backgroundColor: template.color, color: '#fff' }}
        >
          {starting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Play size={15} fill="#fff" />
              Start Workout
            </>
          )}
        </button>
      </div>
    </div>
  )
}
