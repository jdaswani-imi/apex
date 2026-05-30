'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { SupplementLog } from '@/lib/types'
import { groupSupplementsByTime, TIME_GROUP_ORDER } from '@/lib/supplements-catalog'

interface Props {
  initialSupplements: SupplementLog[]
  date: string
}

// Primary label shown in the group header (replaces abstract group names for Night)
const TIME_GROUP_LABEL: Record<string, string> = {
  Morning:   'Morning',
  Midday:    'Midday',
  Afternoon: 'Afternoon',
  Evening:   'Evening',
  Night:     'Before bed',
}

const TIME_GROUP_WINDOWS: Record<string, string> = {
  Morning:   'On wake – 12PM',
  Midday:    '12PM – 1PM',
  Afternoon: '1PM – 6PM',
  Evening:   '6PM – 9PM',
  Night:     '',  // label IS the window, no need to repeat
}

function getUrgencyClass(taken: number, total: number): { text: string; label: string | null } {
  const h = new Date().getHours()
  const remaining = total - taken

  if (taken === total && total > 0) return { text: 'text-accent', label: null }
  if (h < 12) return { text: 'text-muted-foreground', label: null }
  if (h < 18) {
    if (taken < 3) return { text: 'text-amber-400', label: null }
    return { text: 'text-muted-foreground', label: null }
  }
  // after 6PM
  if (taken < 5) return { text: 'text-red-400', label: `${remaining} supplement${remaining !== 1 ? 's' : ''} still due` }
  return { text: 'text-muted-foreground', label: null }
}

export function DashboardSupplementStack({ initialSupplements, date }: Props) {
  const [supplements, setSupplements] = useState(initialSupplements)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())
  const [filling, setFilling] = useState<Set<string>>(new Set())
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const taken = supplements.filter(s => s.taken).length
  const total = supplements.length
  const allDone = taken === total && total > 0
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0

  const urgency = getUrgencyClass(taken, total)

  const grouped = groupSupplementsByTime(supplements)

  async function handleToggle(e: React.MouseEvent, supp: SupplementLog) {
    e.preventDefault()
    e.stopPropagation()

    const newTaken = !supp.taken
    const now = new Date().toTimeString().slice(0, 5)

    if (newTaken) {
      setFilling(prev => new Set(prev).add(supp.id))
      setDismissing(prev => new Set(prev).add(supp.id))

      const timer = setTimeout(() => {
        setSupplements(prev =>
          prev.map(s => s.id === supp.id ? { ...s, taken: true, time_taken: now } : s),
        )
        setDismissing(prev => {
          const next = new Set(prev)
          next.delete(supp.id)
          return next
        })
        setFilling(prev => {
          const next = new Set(prev)
          next.delete(supp.id)
          return next
        })
        dismissTimers.current.delete(supp.id)
      }, 320)

      dismissTimers.current.set(supp.id, timer)
    } else {
      setSupplements(prev =>
        prev.map(s => s.id === supp.id ? { ...s, taken: false, time_taken: null } : s),
      )
    }

    const supabase = createClient()
    await supabase
      .from('supplement_logs')
      .update({ taken: newTaken, time_taken: newTaken ? now : null })
      .eq('id', supp.id)
  }

  return (
    <>
      <style>{`
        @keyframes suppCheckFill {
          0%   { transform: scale(1);   background-color: transparent; }
          40%  { transform: scale(1.35); background-color: rgb(34 197 94); }
          100% { transform: scale(1);   background-color: rgb(34 197 94); }
        }
        .supp-filling { animation: suppCheckFill 200ms ease-out forwards; }
      `}</style>
      <Link
        href={`/supplements?date=${date}`}
        className="block bg-card border border-border rounded-2xl p-5 hover:border-white/15 transition-all duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Supplement Stack</span>
          <div className="flex flex-col items-end gap-0.5">
            <span className={cn('text-sm font-semibold', urgency.text)}>
              {taken}/{total} taken
            </span>
            {urgency.label && (
              <span className="text-[10px] font-medium text-red-400/80">{urgency.label}</span>
            )}
          </div>
        </div>

        {/* Progress bar — colour reflects completion state */}
        <div className="w-full bg-white/5 rounded-full h-1.5 mb-4">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              allDone || pct >= 85 ? 'bg-green-400'
              : pct >= 43 ? 'bg-amber-500'
              : 'bg-red-400',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {allDone ? (
          <div className="flex items-center gap-2 py-1">
            <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground shrink-0">✓</div>
            <span className="text-sm text-accent font-medium">All supplements taken</span>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ group, items }) => {
              const untaken = items.filter(s => !s.taken)
              if (untaken.length === 0 && items.every(s => s.taken)) return null
              return (
                <div key={group}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                      {TIME_GROUP_LABEL[group] ?? group}
                    </span>
                    {TIME_GROUP_WINDOWS[group] && (
                      <span className="text-[9px] text-muted-foreground/40">{TIME_GROUP_WINDOWS[group]}</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {items.slice(0, 3).map(s => {
                      if (s.taken && !dismissing.has(s.id)) return null
                      const isDismissing = dismissing.has(s.id)
                      const isFilling = filling.has(s.id)
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            'flex items-center justify-between transition-all duration-300 ease-in-out',
                            isDismissing
                              ? 'opacity-0 -translate-x-3 max-h-0 mb-0 overflow-hidden'
                              : 'opacity-100 translate-x-0 max-h-10',
                          )}
                        >
                          <span className="text-sm text-foreground truncate pr-2">{s.supplement_name}</span>
                          <div
                            role="button"
                            aria-label={`Mark ${s.supplement_name} as taken`}
                            onClick={(e) => handleToggle(e, s)}
                            className={cn(
                              'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold border transition-all duration-150',
                              isFilling
                                ? 'supp-filling border-green-500 text-white'
                                : 'bg-white/5 border-white/10 text-transparent hover:border-primary/60 hover:bg-primary/10 active:scale-90',
                            )}
                          >
                            ✓
                          </div>
                        </div>
                      )
                    })}
                    {untaken.length > 3 && (
                      <p className="text-[10px] text-muted-foreground/40 pt-0.5">+{untaken.length - 3} more in this group</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Link>
    </>
  )
}
