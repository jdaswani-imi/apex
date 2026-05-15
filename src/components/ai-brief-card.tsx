'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { DailyBrief } from '@/app/api/ai-brief/route'

const READINESS_COLORS: Record<string, { ring: string; label: string; bg: string }> = {
  Peak:     { ring: '#4ade80', label: 'text-green-400',  bg: 'rgba(74,222,128,0.08)' },
  Good:     { ring: '#a3e635', label: 'text-lime-400',   bg: 'rgba(163,230,53,0.08)' },
  Moderate: { ring: '#facc15', label: 'text-yellow-400', bg: 'rgba(250,204,21,0.08)' },
  Low:      { ring: '#f87171', label: 'text-red-400',    bg: 'rgba(248,113,113,0.08)' },
}

const STORAGE_PREFIX = 'apex_brief_'

export function AiBriefCard() {
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const key = `${STORAGE_PREFIX}${today}`

    try {
      const cached = localStorage.getItem(key)
      if (cached) {
        setBrief(JSON.parse(cached) as DailyBrief)
        setLoading(false)
        return
      }
    } catch {}

    fetch('/api/ai-brief')
      .then(r => r.json())
      .then((data: DailyBrief) => {
        setBrief(data)
        try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (error) return null

  const colors = brief ? (READINESS_COLORS[brief.readiness_label] ?? READINESS_COLORS.Moderate) : READINESS_COLORS.Moderate
  const circumference = 2 * Math.PI * 22
  const dash = brief ? (brief.readiness / 100) * circumference : 0

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Sparkles size={12} className="text-orange-500" />
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Daily Brief</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2.5 px-4 py-4 text-zinc-600">
          <Loader2 size={13} className="animate-spin" />
          <span className="text-xs">Analysing your data…</span>
        </div>
      ) : brief ? (
        <div className="px-4 pt-4 pb-4 space-y-4">
          {/* Readiness row */}
          <div className="flex items-center gap-4">
            {/* Circular readiness gauge */}
            <div className="relative w-14 h-14 shrink-0">
              <svg width="56" height="56" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle
                  cx="26" cy="26" r="22"
                  fill="none"
                  stroke={colors.ring}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference}`}
                  transform="rotate(-90 26 26)"
                  style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: colors.ring }}>
                  {brief.readiness}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="inline-block rounded-lg px-2 py-0.5 text-xs font-bold mb-1.5"
                style={{ backgroundColor: colors.bg, border: `1px solid ${colors.ring}33`, color: colors.ring }}
              >
                {brief.readiness_label}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{brief.training_rec}</p>
            </div>
          </div>

          {/* Priorities */}
          <div className="space-y-2">
            {brief.priorities.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-orange-500">{i + 1}</span>
                </div>
                <span className="text-sm text-zinc-300">{p}</span>
              </div>
            ))}
          </div>

          {/* Insight */}
          <div className="bg-secondary/40 rounded-xl px-3 py-2.5">
            <p className="text-xs text-zinc-500 leading-relaxed italic">&ldquo;{brief.insight}&rdquo;</p>
          </div>

          {/* Ask Coach CTA */}
          <Link
            href="/chat"
            className="flex items-center justify-between bg-orange-500/[0.07] border border-orange-500/15 rounded-xl px-3 py-2.5 hover:bg-orange-500/10 transition-colors"
          >
            <span className="text-xs text-zinc-400">Ask Apex to elaborate</span>
            <ChevronRight size={13} className="text-orange-500 shrink-0" />
          </Link>
        </div>
      ) : null}
    </div>
  )
}
