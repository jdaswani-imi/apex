'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'

export default function ProgressDashboard() {
  const [baselines, setBaselines] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/training/progress')
    const data = await res.json()
    setBaselines(data)
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#52525b', paddingTop: '20px' }}>Loading...</div>

  const groups = ['push', 'pull', 'legs'] as const
  const groupLabels: Record<string, string> = { push: '💪 Push', pull: '🔙 Pull', legs: '🦵 Legs' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {groups.map(type => {
        const group = baselines.filter(b => b.session_type === type)
        if (group.length === 0) return null

        return (
          <div key={type}>
            <div style={{ fontSize: '13px', color: '#71717a', fontWeight: 600, marginBottom: '10px' }}>
              {groupLabels[type]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.map(b => {
                const status = (b.progressStatus as string) ?? 'hold'
                const StatusIcon = status === 'progress' ? TrendingUp : status === 'regression' ? TrendingDown : status === 'stale' ? Clock : Minus
                const statusColor = status === 'progress' ? '#22c55e' : status === 'regression' ? '#ef4444' : status === 'stale' ? '#52525b' : '#eab308'

                const targetWt = b.target_weight_kg as number
                const currentWt = b.current_weight_kg as number
                const pct = targetWt > 0
                  ? Math.min(100, Math.round((currentWt / targetWt) * 100))
                  : 0

                return (
                  <div key={b.id as string} style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '14px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>{b.exercise_name as string}</div>
                        <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>
                          {currentWt}kg × {b.current_reps as number} → target {targetWt}kg × {b.target_reps as number}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusIcon size={16} color={statusColor} />
                      </div>
                    </div>
                    <div style={{ height: '3px', backgroundColor: '#1c1c1c', borderRadius: '2px', marginTop: '10px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: statusColor, borderRadius: '2px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
