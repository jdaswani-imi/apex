'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const typeColors: Record<string, string> = {
  push: '#3b82f6',
  pull: '#8b5cf6',
  legs: '#22c55e',
  cardio: '#f97316',
  cricket: '#ef4444',
  arms: '#ec4899',
  rest: '#52525b',
}

export default function SessionHistory() {
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/training/history')
    const data = await res.json()
    setSessions(data)
    setLoading(false)
  }

  const types = ['all', 'push', 'pull', 'legs', 'cardio', 'cricket']
  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.session_type === filter)

  if (loading) return <div style={{ color: '#52525b', paddingTop: '20px' }}>Loading...</div>

  return (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none',
              backgroundColor: filter === t ? '#fff' : '#111',
              color: filter === t ? '#000' : '#71717a',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              flexShrink: 0, textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: '#52525b', textAlign: 'center', paddingTop: '40px', fontSize: '14px' }}>
          No sessions logged yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(session => {
            const sessionType = session.session_type as string
            const sessionId = session.id as string
            const sessionGym = session.gym as string | null | undefined
            const sessionVolumeKg = session.volume_kg as number | null | undefined
            const sessionDurationMin = session.duration_min as number | null | undefined
            const sessionPrs = session.prs as number | null | undefined
            const sessionNotes = session.notes as string | null | undefined
            const color = typeColors[sessionType] ?? '#52525b'
            const isExpanded = expanded === sessionId

            return (
              <div key={sessionId} style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '16px', overflow: 'hidden' }}>
                <div
                  style={{ padding: '16px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isExpanded ? null : sessionId)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', textTransform: 'capitalize' }}>
                          {sessionType}
                        </div>
                        <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>
                          {new Date(session.date as string).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {sessionGym && ` · ${sessionGym}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        {sessionVolumeKg != null && (
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>
                            {sessionVolumeKg.toLocaleString()}kg
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#52525b' }}>
                          {sessionDurationMin ? `${sessionDurationMin}min` : ''}
                          {sessionPrs ? ` · ${sessionPrs} PRs` : ''}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={16} color="#52525b" /> : <ChevronDown size={16} color="#52525b" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (session.exercises as unknown[])?.length > 0 && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1c1c1c' }}>
                    <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(session.exercises as Record<string, unknown>[]).map((ex, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{ex.name as string}</span>
                          <span style={{ fontSize: '13px', color: ex.is_pr ? '#f59e0b' : '#52525b', fontWeight: ex.is_pr ? 600 : 400 }}>
                            {ex.weight_kg as number}kg × {ex.reps as number}
                            {ex.is_pr ? ' 🏆' : null}
                          </span>
                        </div>
                      ))}
                    </div>
                    {sessionNotes && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#52525b', fontStyle: 'italic' }}>
                        {sessionNotes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
