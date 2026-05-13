'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'

export default function ProgressDashboard() {
  const [baselines, setBaselines] = useState<any[]>([])
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
        const group = baselines.filter((b: any) => b.session_type === type)
        if (group.length === 0) return null

        return (
          <div key={type}>
            <div style={{ fontSize: '13px', color: '#71717a', fontWeight: 600, marginBottom: '10px' }}>
              {groupLabels[type]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.map((b: any) => {
                const status = b.progressStatus ?? 'hold'
                const StatusIcon = status === 'progress' ? TrendingUp : status === 'regression' ? TrendingDown : status === 'stale' ? Clock : Minus
                const statusColor = status === 'progress' ? '#22c55e' : status === 'regression' ? '#ef4444' : status === 'stale' ? '#52525b' : '#eab308'

                const pct = b.target_weight_kg > 0
                  ? Math.min(100, Math.round((b.current_weight_kg / b.target_weight_kg) * 100))
                  : 0

                return (
                  <div key={b.id} style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '14px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>{b.exercise_name}</div>
                        <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>
                          {b.current_weight_kg}kg × {b.current_reps} → target {b.target_weight_kg}kg × {b.target_reps}
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
