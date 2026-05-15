'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Play, ChevronRight, Moon, CheckCircle2, Loader2 } from 'lucide-react'

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
}

interface Props {
  isToday: boolean
  date: string
}

export function TodayWorkoutCard({ isToday, date }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TodayData | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    fetch('/api/training/today-template')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

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

  const { isRest, template, sessionType, sessionLogged, sessionDone } = data

  // Rest day
  if (isRest) {
    return (
      <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
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
    )
  }

  // No template — generic link to training page
  if (!template) {
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
            {sessionLogged ? 'Session logged' : isToday ? 'Tap to log session' : 'No session logged'}
          </p>
        </div>
        <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
      </a>
    )
  }

  // Completed
  if (sessionDone) {
    return (
      <a
        href="/training"
        className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 hover:border-green-500/20 transition-all duration-200 no-underline block"
      >
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={20} className="text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            {isToday ? "Today's Session" : 'Session'}
          </p>
          <p className="text-white font-semibold text-base truncate">{template.name}</p>
          <p className="text-green-500 text-xs mt-0.5 font-medium">Completed · great work</p>
        </div>
        <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
      </a>
    )
  }

  // Ready to start — main CTA
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 transition-all duration-200"
      style={{ backgroundColor: '#111', border: `1px solid ${template.color}33` }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${template.color}18`, border: `1px solid ${template.color}30` }}
      >
        <Dumbbell size={20} style={{ color: template.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">
          {isToday ? "Today's Session" : 'Session'}
        </p>
        <p className="text-white font-semibold text-base truncate">{template.name}</p>
        <p className="text-zinc-600 text-xs mt-0.5">
          {template.description}
          {template.exerciseCount > 0 && ` · ${template.exerciseCount} exercises`}
        </p>
      </div>
      <button
        onClick={handleStart}
        disabled={starting}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex-shrink-0 disabled:opacity-60"
        style={{ backgroundColor: template.color, color: '#fff' }}
      >
        {starting
          ? <Loader2 size={14} className="animate-spin" />
          : <><Play size={14} fill="#fff" /> Start</>
        }
      </button>
    </div>
  )
}
