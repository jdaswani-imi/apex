'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, TrendingUp, TrendingDown, Minus, Sunrise, RefreshCw } from 'lucide-react'
import type { MorningIntelligence } from '@/app/api/intelligence/morning/route'
import { FLAG_LABELS, type DayFlag } from '@/lib/intelligence'

const CACHE_KEY_PREFIX = 'apex_morning_v2_'
const DISMISS_KEY_PREFIX = 'apex_morning_dismiss_v2_'

const TONE_CONFIG = {
  recovery: {
    icon: '🔄',
    accent: '#fb923c', // orange
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/5',
    label: 'Recovery Mode',
    labelColor: 'text-orange-400',
  },
  momentum: {
    icon: '⚡',
    accent: '#facc15', // yellow
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/5',
    label: 'Build On It',
    labelColor: 'text-yellow-400',
  },
  maintenance: {
    icon: '🔥',
    accent: '#4ade80', // green
    border: 'border-green-500/20',
    bg: 'bg-green-500/5',
    label: 'On a Streak',
    labelColor: 'text-green-400',
  },
}

const QUALITY_COLORS: Record<string, string> = {
  Excellent: 'text-green-400 bg-green-500/10 border-green-500/20',
  Good: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
  Fair: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Poor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Rough: 'text-red-400 bg-red-500/10 border-red-500/20',
  'No Data': 'text-muted-foreground bg-muted border-border',
}

const FLAG_COLORS: Record<DayFlag, string> = {
  low_protein: 'text-orange-400 bg-orange-500/10',
  missed_supplements: 'text-purple-400 bg-purple-500/10',
  poor_sleep: 'text-blue-400 bg-blue-500/10',
  low_recovery: 'text-red-400 bg-red-500/10',
  skipped_training: 'text-yellow-400 bg-yellow-500/10',
  low_steps: 'text-sky-400 bg-sky-500/10',
  no_data: 'text-muted-foreground bg-muted',
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp size={11} className="text-green-400" />
  if (trend === 'declining') return <TrendingDown size={11} className="text-red-400" />
  return <Minus size={11} className="text-muted-foreground" />
}

export function MorningIntelligenceCard() {
  const [data, setData] = useState<MorningIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `${CACHE_KEY_PREFIX}${today}`
  const dismissKey = `${DISMISS_KEY_PREFIX}${today}`

  useEffect(() => {
    // Clean up old keys (including previous cache versions)
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('apex_morning_')) {
          if (!k.startsWith(CACHE_KEY_PREFIX) && !k.startsWith(DISMISS_KEY_PREFIX)) {
            localStorage.removeItem(k)
          } else if (!k.endsWith(today)) {
            localStorage.removeItem(k)
          }
        }
      }
    } catch {}

    // Check if dismissed today
    try {
      if (localStorage.getItem(dismissKey)) {
        setDismissed(true)
        setLoading(false)
        return
      }
    } catch {}

    // Check cache
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setData(JSON.parse(cached) as MorningIntelligence)
        setLoading(false)
        return
      }
    } catch {}

    // Fetch — bust HTTP cache so code fixes take effect immediately
    fetch(`/api/intelligence/morning?t=${today}`)
      .then(r => r.json())
      .then((d: MorningIntelligence) => {
        setData(d)
        try { localStorage.setItem(cacheKey, JSON.stringify(d)) } catch {}
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  function handleRefresh() {
    try { localStorage.removeItem(cacheKey) } catch {}
    setRefreshing(true)
    setData(null)
    fetch(`/api/intelligence/morning?refresh=true`)
      .then(r => r.json())
      .then((d: MorningIntelligence) => {
        setData(d)
        try { localStorage.setItem(cacheKey, JSON.stringify(d)) } catch {}
      })
      .catch(() => {})
      .finally(() => setRefreshing(false))
  }

  function handleDismiss() {
    try { localStorage.setItem(dismissKey, '1') } catch {}
    setDismissed(true)
  }

  if (dismissed || (!loading && !data)) return null

  if (loading || refreshing) {
    return (
      <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2.5 text-muted-foreground/40">
        <Loader2 size={13} className="animate-spin shrink-0" />
        <span className="text-xs">{refreshing ? 'Refreshing morning check-in…' : 'Loading morning check-in…'}</span>
      </div>
    )
  }

  if (!data) return null

  const toneConfig = TONE_CONFIG[data.tone] ?? TONE_CONFIG.momentum
  const qualityClass = QUALITY_COLORS[data.yesterday_quality] ?? QUALITY_COLORS['No Data']
  const actionableFlags = data.yesterday_flags.filter(f => f !== 'no_data')

  // Mini 7-bar score chart
  const scores = [...data.day_scores].reverse() // oldest first for left-to-right display

  return (
    <div className={`bg-card border ${toneConfig.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sunrise size={12} style={{ color: toneConfig.accent }} />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Morning Check-in</span>
          <span className={`text-[10px] font-bold ${toneConfig.labelColor} ml-1`}>{toneConfig.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={11} />
          </button>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* AI message */}
        <p className="text-sm text-foreground/90 leading-relaxed">{data.message}</p>

        {/* Week pattern */}
        {data.week_pattern && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{data.week_pattern}</p>
          </div>
        )}

        {/* Yesterday summary row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Yesterday</span>
          {data.yesterday_score !== null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${qualityClass}`}>
              {data.yesterday_score}/100 · {data.yesterday_quality}
            </span>
          )}
          {actionableFlags.length > 0 && actionableFlags.map(flag => (
            <span
              key={flag}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${FLAG_COLORS[flag]}`}
            >
              {FLAG_LABELS[flag]}
            </span>
          ))}
        </div>

        {/* 7-day bar chart */}
        {scores.some(d => d.score !== null) && (
          <div className="flex items-end gap-1 h-8">
            {scores.map((d) => {
              const h = d.score !== null ? Math.max(4, Math.round((d.score / 100) * 28)) : 4
              const isYesterday = d.date === data.day_scores[0]?.date
              const barColor =
                d.score === null ? 'bg-muted' :
                d.score >= 85 ? 'bg-green-500/70' :
                d.score >= 70 ? 'bg-lime-500/70' :
                d.score >= 50 ? 'bg-yellow-500/70' :
                d.score >= 30 ? 'bg-orange-500/70' :
                'bg-red-500/70'
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center gap-0.5"
                  title={`${d.date}: ${d.score ?? 'no data'}`}
                >
                  <div
                    className={`w-full rounded-sm ${barColor} ${isYesterday ? 'ring-1 ring-white/20' : ''}`}
                    style={{ height: `${h}px` }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Week avg + trend */}
        {(data.week_weighted_avg !== null || data.week_trend !== 'insufficient_data') && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
            {data.week_weighted_avg !== null && (
              <span>7-day avg <span className="text-muted-foreground font-semibold">{data.week_weighted_avg}</span></span>
            )}
            {data.week_trend !== 'insufficient_data' && (
              <span className="flex items-center gap-1">
                <TrendIcon trend={data.week_trend} />
                <span className="capitalize">{data.week_trend}</span>
              </span>
            )}
          </div>
        )}

        {/* Recovery actions */}
        {data.recovery_actions.length > 0 && (
          <div className="space-y-1.5 pt-0.5">
            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Today&apos;s focus</span>
            {data.recovery_actions.map((action, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${toneConfig.accent}18` }}
                >
                  <span className="text-[8px] font-bold" style={{ color: toneConfig.accent }}>{i + 1}</span>
                </div>
                <span className="text-xs text-foreground/80">{action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
