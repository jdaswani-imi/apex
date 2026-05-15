'use client'

import React, { useState, useEffect } from 'react'
import { Moon, Zap, Activity, Wind, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WhoopSleep } from '@/lib/types'

function fmtDuration(hrs: number | null) {
  if (hrs === null) return '—'
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return `${h}h ${m}m`
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function perfColorClass(pct: number | null) {
  if (pct === null) return 'text-zinc-600'
  if (pct >= 70) return 'text-emerald-400'
  if (pct >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

interface StatPillProps {
  label: string
  value: string | number | null
  unit?: string
  icon: React.ElementType
  colorClass: string
  bgClass: string
}

function StatPill({ label, value, unit, icon: Icon, colorClass, bgClass }: StatPillProps) {
  return (
    <div className={cn('rounded-2xl p-4 flex flex-col gap-2', bgClass)}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={colorClass} />
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-3xl font-bold leading-none', value !== null ? colorClass : 'text-zinc-700')}>
          {value ?? '—'}
        </span>
        {unit && value !== null && (
          <span className="text-xs text-zinc-500 font-medium">{unit}</span>
        )}
      </div>
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex-1 flex items-end h-full">
      <div className="w-full h-12 bg-white/[0.04] rounded-sm flex items-end overflow-hidden">
        <div
          className="w-full bg-indigo-400 rounded-t-sm transition-all duration-500"
          style={{ height: `${pct}%`, minHeight: pct > 0 ? '3px' : '0' }}
        />
      </div>
    </div>
  )
}

function SleepStageBar({ deep, rem, light, awake }: {
  deep: number | null
  rem: number | null
  light: number | null
  awake: number | null
}) {
  const total = (deep ?? 0) + (rem ?? 0) + (light ?? 0) + (awake ?? 0)
  if (total === 0) return null
  const pct = (v: number | null) => Math.round(((v ?? 0) / total) * 100)
  const stages = [
    { label: 'Deep', value: deep, pct: pct(deep), barClass: 'bg-indigo-500', dotClass: 'bg-indigo-500' },
    { label: 'REM', value: rem, pct: pct(rem), barClass: 'bg-violet-500', dotClass: 'bg-violet-500' },
    { label: 'Light', value: light, pct: pct(light), barClass: 'bg-blue-400', dotClass: 'bg-blue-400' },
    { label: 'Awake', value: awake, pct: pct(awake), barClass: 'bg-zinc-700', dotClass: 'bg-zinc-700' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-lg overflow-hidden h-2.5">
        {stages.map(s => s.pct > 0 && (
          <div key={s.label} className={cn('h-full', s.barClass)} style={{ width: `${s.pct}%` }} />
        ))}
      </div>
      <div className="flex gap-4 flex-wrap">
        {stages.slice(0, 3).map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-sm', s.dotClass)} />
            <span className="text-[11px] text-zinc-500">{s.label}</span>
            <span className="text-[11px] text-zinc-400 font-semibold">{s.value ?? 0}m</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SleepPage() {
  const [sleep, setSleep] = useState<WhoopSleep[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [tokenExpired, setTokenExpired] = useState(false)

  useEffect(() => {
    fetchData()
    fetch('/api/whoop/status')
      .then(r => r.json())
      .then(d => { if (d.expired && !d.canRefresh) setTokenExpired(true) })
      .catch(() => {})
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/whoop/data')
      if (res.ok) {
        const json = await res.json()
        setSleep(json.sleep ?? [])
      }
    } catch {}
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/whoop/sync', { method: 'POST' })
      await fetchData()
    } catch {}
    setSyncing(false)
  }

  const latest = sleep[0] ?? null
  const records = [...sleep].reverse().slice(-14)
  const maxDur = Math.max(...records.map(r => r.duration_hrs ?? 0), 1)
  const noData = !loading && sleep.length === 0

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 md:px-6 pt-4 md:pt-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">WHOOP</p>
            <h1 className="text-3xl font-bold text-foreground leading-tight">Sleep</h1>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center disabled:opacity-50 transition-opacity"
          >
            <RefreshCw size={15} className={cn('text-indigo-400', syncing && 'animate-spin')} />
          </button>
        </div>

        {tokenExpired && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-300">WHOOP session expired</p>
              <p className="text-xs text-zinc-500 mt-0.5">Reconnect to sync fresh data</p>
            </div>
            <a
              href="/api/whoop/login"
              className="bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-xl shrink-0"
            >
              Reconnect
            </a>
          </div>
        )}

        {loading && (
          <div className="flex justify-center pt-16">
            <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        )}

        {noData && (
          <div className="flex flex-col items-center pt-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
              <Moon size={28} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground mb-1">No sleep data yet</p>
              <p className="text-sm text-zinc-600">Connect your WHOOP in Settings to start tracking</p>
            </div>
            <button
              onClick={handleSync}
              className="bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl"
            >
              Sync Now
            </button>
          </div>
        )}

        {!loading && latest && (
          <>
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <StatPill
                label="Duration"
                value={latest.duration_hrs ? `${latest.duration_hrs.toFixed(1)}` : null}
                unit="hrs"
                icon={Moon}
                colorClass="text-indigo-400"
                bgClass="bg-indigo-500/10"
              />
              <StatPill
                label="Performance"
                value={latest.sleep_performance_pct ?? null}
                unit="%"
                icon={Zap}
                colorClass="text-emerald-400"
                bgClass="bg-emerald-500/10"
              />
              <StatPill
                label="Efficiency"
                value={latest.sleep_efficiency_pct != null ? parseFloat(String(latest.sleep_efficiency_pct)).toFixed(1) : null}
                unit="%"
                icon={Activity}
                colorClass="text-blue-400"
                bgClass="bg-blue-500/10"
              />
              <StatPill
                label="Resp. Rate"
                value={latest.respiratory_rate ? `${latest.respiratory_rate.toFixed(1)}` : null}
                unit="/min"
                icon={Wind}
                colorClass="text-orange-400"
                bgClass="bg-orange-500/10"
              />
            </div>

            {/* Sleep stages */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Last Night</span>
                <span className="text-xs text-zinc-600">
                  {fmtTime(latest.start_time)} → {fmtTime(latest.end_time)}
                </span>
              </div>
              <SleepStageBar
                deep={latest.deep_sleep_min}
                rem={latest.rem_min}
                light={latest.light_sleep_min}
                awake={latest.awake_min}
              />
            </div>

            {/* 14-day trend */}
            {records.length > 1 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-4">
                  14-Day Duration Trend
                </p>
                <div className="flex gap-1 items-end h-16">
                  {records.map((r, i) => (
                    <div key={i} className="flex-1 h-full">
                      <MiniBar value={r.duration_hrs ?? 0} max={Math.max(maxDur, 9)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent nights */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Recent Nights</p>
              </div>
              {sleep.slice(0, 10).map((s, i) => (
                <div
                  key={s.id}
                  className={cn('px-4 py-3 flex items-center gap-3', i > 0 && 'border-t border-white/[0.04]')}
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Moon size={15} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 font-medium">{fmtDate(s.date)}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {s.duration_hrs ? fmtDuration(s.duration_hrs) : '—'}
                      {s.deep_sleep_min ? ` · Deep ${s.deep_sleep_min}m` : ''}
                      {s.rem_min ? ` · REM ${s.rem_min}m` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-sm font-bold', perfColorClass(s.sleep_performance_pct ?? null))}>
                      {s.sleep_performance_pct ? `${s.sleep_performance_pct}%` : '—'}
                    </p>
                    <p className="text-[10px] text-zinc-600">perf</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
