'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Play, ChevronRight, Moon, CheckCircle2, Loader2, CalendarClock } from 'lucide-react'

interface NextWorkout {
  daysAway: number
  date: string
  dayLabel: string
  template: TodayTemplate | null
  sessionType: string
}

function NextBadge({ next }: { next: NextWorkout | null | undefined }) {
  if (!next) return null
  const t = next.template
  const label = t ? t.name : next.sessionType
  const exStr = t?.exerciseCount ? ` · ${t.exerciseCount} ex` : ''
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-2">
      <CalendarClock size={12} className="text-muted-foreground/50 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground text-xs font-semibold">{next.dayLabel}</span>
        <span className="text-muted-foreground/40 text-xs"> — {label}{exStr}</span>
      </div>
      {t && (
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
      )}
    </div>
  )
}

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

interface DayCard {
  today: TodayData
  next: NextWorkout | null
}

interface Props {
  isToday: boolean
  date: string
}

const cache = new Map<string, DayCard>()

export function TodayWorkoutCard({ isToday, date }: Props) {
  const router = useRouter()
  const [card, setCard] = useState<DayCard | null>(() => cache.get(date) ?? null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const cached = cache.get(date)
    if (cached) {
      setCard(cached)
      return
    }

    setCard(null)
    const controller = new AbortController()

    fetch(`/api/training/day-card?date=${date}`, { signal: controller.signal })
      .then(r => r.json())
      .then((d: DayCard) => {
        cache.set(date, d)
        setCard(d)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [date])

  async function handleStart() {
    const template = card?.today.template
    if (!template || starting) return
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

  if (!card) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-2 bg-muted rounded w-24" />
        </div>
      </div>
    )
  }

  const { isRest, template, sessionType, sessionDone, alternativeSession } = card.today
  const next = card.next

  if (isRest) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center flex-shrink-0">
            <Moon size={20} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {isToday ? "Today's Session" : 'Session'}
            </p>
            <p className="text-foreground font-semibold text-base">Rest Day</p>
            <p className="text-muted-foreground/60 text-xs mt-0.5">Recovery · light activity encouraged</p>
          </div>
        </div>
        <NextBadge next={next} />
      </div>
    )
  }

  if (!template) {
    if (sessionDone) {
      const displayName = alternativeSession
        ? alternativeSession.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : sessionType
      return (
        <a
          href="/training"
          className="bg-card border border-border rounded-2xl p-4 hover:border-green-500/20 transition-all duration-200 no-underline block"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={20} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-0.5">
                {isToday ? "Today's Session" : 'Session'}
              </p>
              <p className="text-foreground font-semibold text-base truncate">{displayName}</p>
              <p className="text-green-500 text-xs mt-0.5 font-medium">Training done for today</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground/30 flex-shrink-0" />
          </div>
          <NextBadge next={next} />
        </a>
      )
    }
    return (
      <a
        href="/training"
        className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/20 transition-all duration-200 no-underline block"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Dumbbell size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-0.5">
            {isToday ? "Today's Session" : 'Session'}
          </p>
          <p className="text-foreground font-semibold text-base truncate">{sessionType}</p>
          <p className="text-muted-foreground/60 text-xs mt-0.5">
            {isToday ? 'Tap to log session' : 'No session logged'}
          </p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground/30 flex-shrink-0" />
      </a>
    )
  }

  if (sessionDone) {
    const isAlternative = !!alternativeSession
    const displayName = isAlternative
      ? alternativeSession!.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : template.name
    const subtext = isAlternative ? 'Training done for today' : 'Completed'

    return (
      <a
        href="/training"
        className="bg-card border border-border rounded-2xl p-4 hover:border-green-500/20 transition-all duration-200 no-underline block"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {isToday ? "Today's Session" : 'Session'}
            </p>
            <p className="text-foreground font-semibold text-base truncate">{displayName}</p>
            <p className="text-green-500 text-xs mt-0.5 font-medium">{subtext}</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground/30 flex-shrink-0" />
        </div>
        <NextBadge next={next} />
      </a>
    )
  }

  // Ready to start
  return (
    <div
      className="bg-card rounded-2xl overflow-hidden transition-all duration-200"
      style={{ border: `1px solid ${template.color}33` }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${template.color}18`, border: `1px solid ${template.color}30` }}
          >
            <Dumbbell size={20} style={{ color: template.color }} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {isToday ? "Today's Session" : 'Session'}
            </p>
            <p className="text-foreground font-semibold text-base leading-tight truncate">{template.name}</p>
            {template.description && (
              <p className="text-muted-foreground/60 text-xs mt-0.5 leading-snug">{template.description}</p>
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

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-60 active:scale-[0.98]"
          style={{ backgroundColor: template.color, color: '#0d0c0b' }}
        >
          {starting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Play size={15} fill="#0d0c0b" />
              Start Workout
            </>
          )}
        </button>
      </div>
    </div>
  )
}
