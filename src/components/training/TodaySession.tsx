'use client'

import { useEffect, useState } from 'react'
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  onStartSession: (sessionId: string) => void
}

export default function TodaySession({ onStartSession }: Props) {
  // TodaySession data is an aggregated API response without a generated type
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/training/today')
    const d = await res.json()
    setData(d)
    setLoading(false)
  }

  async function startSession() {
    setStarting(true)
    const res = await fetch('/api/training/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        session_type: (data?.sessionType as string) ?? 'push',
        gym: (data?.gymName as string) ?? 'TopGym',
        started_at: new Date().toISOString(),
      }),
    })
    const session = await res.json()
    setStarting(false)
    onStartSession(session.id)
  }

  if (loading) return <div style={{ color: '#52525b', paddingTop: '20px' }}>Loading...</div>

  const recovery = data?.recovery as number | null
  const recoveryColor = recovery
    ? recovery >= 67 ? '#22c55e' : recovery >= 34 ? '#eab308' : '#ef4444'
    : '#52525b'
  const recoveryLabel = recovery
    ? recovery >= 67 ? 'Train hard' : recovery >= 34 ? 'Train smart · RPE 7–8' : 'Rest or Zone 2 only'
    : 'Connect Whoop'

  const existingSession = data?.todaySession as Record<string, unknown> | undefined
  const exercises = (data?.exercises as Record<string, unknown>[] | undefined) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Session type + recovery */}
      <div style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#52525b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long' })}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
              {(data?.sessionType as string) ?? 'Rest'}
            </div>
            {data?.lastSession != null && (
              <div style={{ fontSize: '12px', color: '#52525b', marginTop: '4px' }}>
                Last: {new Date((data.lastSession as Record<string, unknown>).date as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {((data.lastSession as Record<string, unknown>).volume_kg as number)?.toLocaleString()}kg
              </div>
            )}
          </div>
          {recovery && (
            <div style={{
              backgroundColor: `${recoveryColor}15`,
              border: `1px solid ${recoveryColor}40`,
              borderRadius: '12px', padding: '8px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: recoveryColor }}>{recovery}%</div>
              <div style={{ fontSize: '10px', color: recoveryColor, marginTop: '2px' }}>Recovery</div>
            </div>
          )}
        </div>
        <div style={{
          marginTop: '12px', padding: '10px 14px',
          backgroundColor: `${recoveryColor}10`,
          border: `1px solid ${recoveryColor}20`,
          borderRadius: '10px',
          fontSize: '13px', color: recoveryColor, fontWeight: 500,
        }}>
          {recoveryLabel}
        </div>
      </div>

      {/* Exercises for today */}
      {exercises.length > 0 && (
        <div style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '20px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#52525b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
            Today&apos;s Exercises
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {exercises.map((ex, i) => {
              const status = ex.progressStatus
              const StatusIcon = status === 'progress' ? TrendingUp : status === 'regression' ? TrendingDown : Minus
              const statusColor = status === 'progress' ? '#22c55e' : status === 'regression' ? '#ef4444' : '#eab308'

              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: i < exercises.length - 1 ? '1px solid #18181b' : 'none',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>{ex.exercise_name as string}</div>
                    <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>
                      Target: {ex.target_weight_kg as number}kg × {ex.target_reps as number} · {(ex.current_sets as number) ?? 3} sets
                    </div>
                    {ex.lastPerformance != null && (
                      <div style={{ fontSize: '11px', color: '#3f3f46', marginTop: '1px' }}>
                        Last: {(ex.lastPerformance as Record<string, unknown>).weight_kg as number}kg × {(ex.lastPerformance as Record<string, unknown>).reps as number}
                      </div>
                    )}
                  </div>
                  <StatusIcon size={16} color={statusColor} style={{ flexShrink: 0 }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Already logged today */}
      {existingSession && (
        <div style={{
          backgroundColor: '#0a1f0a', border: '1px solid #14532d',
          borderRadius: '16px', padding: '14px 16px',
          fontSize: '13px', color: '#4ade80',
        }}>
          ✓ Session already logged today · {(existingSession.volume_kg as number)?.toLocaleString()}kg · {existingSession.prs as number} PRs
        </div>
      )}

      {/* Start button */}
      <button
        onClick={startSession}
        disabled={starting}
        style={{
          width: '100%', backgroundColor: '#fff', color: '#000',
          fontWeight: 700, padding: '18px', borderRadius: '18px',
          border: 'none', cursor: 'pointer', fontSize: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          opacity: starting ? 0.7 : 1,
        }}
      >
        <Zap size={18} />
        {starting ? 'Starting...' : existingSession ? 'Log Another Session' : 'Start Session'}
      </button>
    </div>
  )
}
