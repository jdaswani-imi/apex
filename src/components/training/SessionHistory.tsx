'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const typeColors: Record<string, string> = {
  push: '#3b82f6',
  pull: '#8b5cf6',
  legs: '#22c55e',
  cardio: '#f97316',
  hiit: '#f97316',
  running: '#f97316',
  cycling: '#f97316',
  swimming: '#06b6d4',
  walk: '#84cc16',
  cricket: '#ff6b6b',
  arms: '#ec4899',
  rest: '#52525b',
}

const CARDIO_SESSION_TYPES = new Set(['cardio', 'hiit', 'running', 'cycling', 'swimming', 'walk'])

type FilterKey = 'all' | 'push' | 'pull' | 'legs' | 'cardio' | 'cricket'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'push', label: 'Push' },
  { key: 'pull', label: 'Pull' },
  { key: 'legs', label: 'Legs' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'cricket', label: 'Cricket' },
]

function formatCardioExercise(ex: Record<string, unknown>): string | null {
  if (ex.weight_kg != null && ex.reps != null) return null
  const parts: string[] = []
  if (ex.distance_m) parts.push(`${((ex.distance_m as number) / 1000).toFixed(1)}km`)
  if (ex.duration_sec) parts.push(`${Math.round((ex.duration_sec as number) / 60)}min`)
  if (ex.notes) parts.push(ex.notes as string)
  return parts.length > 0 ? parts.join(' · ') : null
}

export default function SessionHistory() {
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/training/history')
    const data = await res.json()
    setSessions(data)
    setLoading(false)
  }

  const filtered = filter === 'all'
    ? sessions
    : filter === 'cardio'
      ? sessions.filter(s => CARDIO_SESSION_TYPES.has((s.session_type as string)?.toLowerCase()))
      : sessions.filter(s => (s.session_type as string)?.toLowerCase() === filter)

  if (loading) return <div style={{ color: '#52525b', paddingTop: '20px' }}>Loading...</div>

  return (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none',
              backgroundColor: filter === key ? '#fff' : '#111',
              color: filter === key ? '#000' : '#71717a',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {label}
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
            const isCardioSession = CARDIO_SESSION_TYPES.has(sessionType?.toLowerCase())
            const color = typeColors[sessionType?.toLowerCase()] ?? '#52525b'
            const isExpanded = expanded === sessionId
            const exercises = session.exercises as Record<string, unknown>[] | undefined

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
                          {sessionType?.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>
                          {new Date(session.date as string).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {sessionGym && ` · ${sessionGym}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        {isCardioSession ? (
                          <>
                            {sessionDurationMin != null && (
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>
                                {sessionDurationMin}min
                              </div>
                            )}
                            {/* Show distance from first cardio exercise entry */}
                            {(() => {
                              const cardioEx = exercises?.find(ex => ex.distance_m != null)
                              if (!cardioEx) return null
                              return (
                                <div style={{ fontSize: '11px', color: '#f97316' }}>
                                  {((cardioEx.distance_m as number) / 1000).toFixed(1)}km
                                </div>
                              )
                            })()}
                          </>
                        ) : (
                          <>
                            {sessionVolumeKg != null && (
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>
                                {sessionVolumeKg.toLocaleString()}kg
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: '#52525b' }}>
                              {sessionDurationMin ? `${sessionDurationMin}min` : ''}
                              {sessionPrs ? ` · ${sessionPrs} PRs` : ''}
                            </div>
                          </>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp size={16} color="#52525b" /> : <ChevronDown size={16} color="#52525b" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1c1c1c' }}>
                    {exercises && exercises.length > 0 && (
                      <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {exercises.map((ex, i) => {
                          const cardioStr = formatCardioExercise(ex)
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{ex.name as string}</span>
                              {cardioStr ? (
                                <span style={{ fontSize: '13px', color: '#f97316', fontWeight: 500 }}>{cardioStr}</span>
                              ) : (
                                <span style={{ fontSize: '13px', color: ex.is_pr ? '#f59e0b' : '#52525b', fontWeight: ex.is_pr ? 600 : 400 }}>
                                  {ex.weight_kg as number}kg × {ex.reps as number}
                                  {ex.is_pr ? ' 🏆' : null}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {isCardioSession && exercises && exercises.length > 0 && (() => {
                      const cardioEx = exercises.find(ex => ex.notes)
                      if (!cardioEx?.notes) return null
                      return (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {(cardioEx.notes as string).split(' · ').map((part, i) => (
                            <span key={i} style={{
                              fontSize: '11px', fontWeight: 600,
                              color: '#f97316', backgroundColor: '#f9731611',
                              padding: '3px 8px', borderRadius: '6px',
                            }}>
                              {part}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
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
