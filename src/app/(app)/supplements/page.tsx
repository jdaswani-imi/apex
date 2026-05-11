'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { SupplementLog } from '@/lib/types'

const today = new Date().toISOString().split('T')[0]

export default function SupplementsPage() {
  const [supplements, setSupplements] = useState<SupplementLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSupplements = useCallback(async () => {
    const res = await fetch(`/api/supplements?date=${today}`)
    const data = await res.json()
    setSupplements(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSupplements()
  }, [fetchSupplements])

  async function toggle(supp: SupplementLog) {
    const supabase = createClient()
    const newTaken = !supp.taken
    const now = new Date().toTimeString().slice(0, 5)

    // Optimistic update
    setSupplements(prev =>
      prev.map(s => s.id === supp.id
        ? { ...s, taken: newTaken, time_taken: newTaken ? now : null }
        : s,
      ),
    )

    await supabase
      .from('supplement_logs')
      .update({ taken: newTaken, time_taken: newTaken ? now : null })
      .eq('id', supp.id)
  }

  const taken = supplements.filter(s => s.taken).length
  const total = supplements.length
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0
  const allDone = taken === total && total > 0

  return (
    <div className="px-4 pt-14 pb-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-condensed text-3xl font-bold text-white uppercase tracking-wide">Supplement Stack</h1>
        <p className="text-zinc-500 text-sm mt-1">{today}</p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-sm font-semibold', allDone ? 'text-green-400' : 'text-zinc-400')}>
            {taken}/{total} taken
          </span>
          <span className={cn('text-sm font-bold', allDone ? 'text-green-400' : 'text-zinc-500')}>
            {pct}%
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2">
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-500',
              allDone ? 'bg-green-400' : 'bg-violet-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] bg-zinc-900/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {supplements.map(s => (
            <button
              key={s.id}
              onClick={() => toggle(s)}
              className={cn(
                'w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 active:scale-[0.98] cursor-pointer',
                s.taken
                  ? 'bg-green-950/40 border-green-800/40'
                  : 'bg-zinc-900/60 border-white/[0.06] hover:border-white/10',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'text-sm font-semibold leading-snug',
                  s.taken ? 'text-green-400 line-through decoration-green-700' : 'text-zinc-100',
                )}>
                  {s.supplement_name}
                </p>
                <p className="text-zinc-600 text-xs mt-0.5">
                  {s.time_taken ? `Taken at ${s.time_taken}` : s.notes ?? ''}
                </p>
              </div>
              <div className={cn(
                'ml-3 w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all duration-200',
                s.taken
                  ? 'bg-green-400 text-black'
                  : 'bg-white/5 border-2 border-zinc-700 text-transparent',
              )}>
                ✓
              </div>
            </button>
          ))}
        </div>
      )}

      {allDone && (
        <div className="mt-6 text-center">
          <p className="text-green-400 font-semibold text-sm">All done for today</p>
        </div>
      )}
    </div>
  )
}
