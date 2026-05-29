'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, ChevronRight, RefreshCw, Zap } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DailyBrief } from '@/app/api/ai-brief/route'

const READINESS_CONFIG: Record<string, { label: string; bar: string; text: string; bg: string; border: string }> = {
  Peak:     { label: 'Peak',     bar: 'bg-green-400',  text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/25' },
  Good:     { label: 'Good',     bar: 'bg-lime-400',   text: 'text-lime-400',   bg: 'bg-lime-500/10',   border: 'border-lime-500/25' },
  Moderate: { label: 'Moderate', bar: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25' },
  Low:      { label: 'Low',      bar: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25' },
}

const STORAGE_PREFIX = 'apex_brief_'

interface AiBriefCardProps {
  protein: number | null
  steps: number | null
  calories: number | null
  recovery: number | null
  suppTaken: number
  suppTotal: number
}

function buildFingerprint(props: AiBriefCardProps): string {
  return `${props.protein ?? 0}_${props.steps ?? 0}_${props.calories ?? 0}_${props.recovery ?? 'x'}_${props.suppTaken}_${props.suppTotal}`
}

function pruneOldBriefKeys(today: string) {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
    for (const k of keys) {
      if (!k.includes(today)) localStorage.removeItem(k)
    }
  } catch {}
}

export function AiBriefCard(props: AiBriefCardProps) {
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fingerprint = buildFingerprint(props)

  function fetchBrief(cacheKey: string, force = false) {
    if (!force) {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          setBrief(JSON.parse(cached) as DailyBrief)
          setLoading(false)
          return
        }
      } catch {}
    }

    fetch(force ? '/api/ai-brief?refresh=true' : '/api/ai-brief')
      .then(r => r.json())
      .then((data: DailyBrief) => {
        setBrief(data)
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch {}
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    pruneOldBriefKeys(today)
    const key = `${STORAGE_PREFIX}${today}_${fingerprint}`
    fetchBrief(key)
  }, [fingerprint])

  function handleRefresh() {
    const today = new Date().toISOString().split('T')[0]
    const key = `${STORAGE_PREFIX}${today}_${fingerprint}`
    try { localStorage.removeItem(key) } catch {}
    setRefreshing(true)
    setBrief(null)
    fetchBrief(key, true)
  }

  if (error) return null

  const cfg = brief ? (READINESS_CONFIG[brief.readiness_label] ?? READINESS_CONFIG.Moderate) : READINESS_CONFIG.Moderate

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-primary" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Daily Brief</span>
        </div>
        {!loading && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-40"
            aria-label="Refresh brief"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {loading || refreshing ? (
        <div className="flex items-center gap-2.5 px-4 py-4 text-muted-foreground/40">
          <Loader2 size={13} className="animate-spin" />
          <span className="text-xs">Analysing your data…</span>
        </div>
      ) : brief ? (
        <div className="px-4 pt-4 pb-4 space-y-4">
          {/* Readiness row — flat bar + label, no circular gauge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Readiness</span>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', cfg.text, cfg.bg, cfg.border)}>
                {cfg.label}
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div
                className={cn('h-1.5 rounded-full transition-all duration-500', cfg.bar)}
                style={{ width: `${brief.readiness}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{brief.training_rec}</p>
          </div>

          {/* Coaching note */}
          {brief.coaching_note && (
            <p className="text-xs text-foreground/75 leading-relaxed">{brief.coaching_note}</p>
          )}

          {/* Priorities */}
          <div className="space-y-2">
            {brief.priorities.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                </div>
                <span className="text-sm text-foreground/80">{p}</span>
              </div>
            ))}
          </div>

          {/* Key lever */}
          {brief.lever && (
            <div className="flex items-start gap-2.5 rounded-xl bg-primary/[0.07] border border-primary/15 px-3 py-2.5">
              <Zap size={11} className="text-primary shrink-0 mt-0.5" />
              <div>
                <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest block mb-0.5">Key lever</span>
                <span className="text-xs text-foreground/80 leading-relaxed">{brief.lever}</span>
              </div>
            </div>
          )}

          {/* Insight */}
          <div className="bg-secondary/40 rounded-xl px-3 py-2.5">
            <p className="text-xs text-muted-foreground leading-relaxed italic">&ldquo;{brief.insight}&rdquo;</p>
          </div>

          {/* Ask Coach CTA */}
          <Link
            href="/chat"
            className="flex items-center justify-between bg-primary/[0.07] border border-primary/15 rounded-xl px-3 py-2.5 hover:bg-primary/10 transition-colors"
          >
            <span className="text-xs text-muted-foreground">Ask Apex to elaborate</span>
            <ChevronRight size={13} className="text-primary shrink-0" />
          </Link>
        </div>
      ) : null}
    </div>
  )
}
