'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { SupplementLog } from '@/lib/types'

interface Props {
  initialSupplements: SupplementLog[]
  date: string
}

const VISIBLE_MAX = 4

export function DashboardSupplementStack({ initialSupplements, date }: Props) {
  const [supplements, setSupplements] = useState(initialSupplements)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const taken = supplements.filter(s => s.taken).length
  const total = supplements.length
  const allDone = taken === total && total > 0
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0

  // Queue: untaken supplements not yet animated away
  const untaken = supplements.filter(s => !s.taken)
  // Show up to VISIBLE_MAX — includes ones mid-dismiss so the slot stays open during animation
  const visible = untaken.slice(0, VISIBLE_MAX)

  async function handleToggle(e: React.MouseEvent, supp: SupplementLog) {
    e.preventDefault()
    e.stopPropagation()

    const newTaken = !supp.taken
    const now = new Date().toTimeString().slice(0, 5)

    if (newTaken) {
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
    <Link
      href={`/supplements?date=${date}`}
      className="block bg-card border border-border rounded-2xl p-5 hover:border-white/15 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Supplement Stack</span>
        <span className={cn('text-sm font-semibold', allDone ? 'text-accent' : 'text-muted-foreground')}>
          {taken}/{total} taken
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mb-3">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all duration-500',
            allDone ? 'bg-accent' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Supplement queue */}
      {allDone ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground shrink-0">✓</div>
          <span className="text-sm text-accent font-medium">All supplements taken</span>
        </div>
      ) : (
        <div className="space-y-2 overflow-hidden">
          {visible.map(s => {
            const isDismissing = dismissing.has(s.id)
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
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-white/5 border border-white/10 text-transparent hover:border-primary/60 hover:bg-primary/10 active:scale-90 transition-all duration-150"
                >
                  ✓
                </div>
              </div>
            )
          })}
          {untaken.length > VISIBLE_MAX && (
            <p className="text-muted-foreground text-xs pt-0.5">+{untaken.length - VISIBLE_MAX} more · tap to manage</p>
          )}
        </div>
      )}
    </Link>
  )
}
