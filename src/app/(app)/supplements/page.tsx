'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { SupplementLog } from '@/lib/types'
import { getCatalogEntry, groupSupplementsByTime, CATEGORY_COLORS } from '@/lib/supplements-catalog'

const today = new Date().toISOString().split('T')[0]

export default function SupplementsPage() {
  const [supplements, setSupplements] = useState<SupplementLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchSupplements = useCallback(async () => {
    const res = await fetch(`/api/supplements?date=${today}`)
    const data = await res.json()
    setSupplements(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSupplements()
  }, [fetchSupplements])

  async function toggle(e: React.MouseEvent, supp: SupplementLog) {
    e.stopPropagation()
    const supabase = createClient()
    const newTaken = !supp.taken
    const now = new Date().toTimeString().slice(0, 5)

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

  async function updateTimeTaken(supp: SupplementLog, time: string) {
    const supabase = createClient()
    setSupplements(prev =>
      prev.map(s => s.id === supp.id ? { ...s, time_taken: time || null } : s),
    )
    await supabase
      .from('supplement_logs')
      .update({ time_taken: time || null })
      .eq('id', supp.id)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => prev === id ? null : id)
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
        <div className="space-y-6">
          {groupSupplementsByTime(supplements).map(({ group, items }) => (
            <div key={group}>
              <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold mb-2.5 px-1">
                {group}
              </p>
              <div className="space-y-2.5">
                {items.map(s => {
            const catalog = getCatalogEntry(s.supplement_name)
            const colors = catalog ? CATEGORY_COLORS[catalog.categoryColor] : null
            const isExpanded = expanded === s.id

            return (
              <div
                key={s.id}
                className={cn(
                  'rounded-2xl border transition-all duration-200',
                  s.taken
                    ? 'bg-green-950/40 border-green-800/40'
                    : 'bg-zinc-900/60 border-white/[0.06]',
                )}
              >
                {/* Main row */}
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full flex items-center justify-between p-4 text-left active:scale-[0.99] cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn(
                        'text-sm font-semibold leading-snug',
                        s.taken ? 'text-green-400 line-through decoration-green-700' : 'text-zinc-100',
                      )}>
                        {s.supplement_name}
                      </p>
                      {catalog && (
                        <span className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0',
                          colors?.bg, colors?.text,
                        )}>
                          {catalog.category}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {s.time_taken ? `Taken at ${s.time_taken}` : (catalog?.timing ?? s.notes ?? '')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {/* Expand chevron */}
                    <svg
                      className={cn('w-4 h-4 text-zinc-600 transition-transform duration-200', isExpanded && 'rotate-180')}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>

                    {/* Check button */}
                    <div
                      role="button"
                      onClick={(e) => toggle(e, s)}
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
                        s.taken
                          ? 'bg-green-400 text-black'
                          : 'bg-white/5 border-2 border-zinc-700 text-transparent hover:border-zinc-500',
                      )}
                    >
                      ✓
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.04] mt-0 pt-3 space-y-4">

                    {/* Editable consumption time */}
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold shrink-0">Time taken</p>
                      <input
                        type="time"
                        value={s.time_taken ?? ''}
                        onChange={e => updateTimeTaken(s, e.target.value)}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-zinc-300 outline-none focus:border-violet-500/50 transition-colors"
                      />
                      {!s.taken && !s.time_taken && (
                        <span className="text-[10px] text-zinc-700">set when marked done</span>
                      )}
                    </div>

                    {catalog && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white/[0.03] rounded-xl p-3">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Dose</p>
                            <p className="text-xs text-zinc-300">{catalog.dose}</p>
                          </div>
                          <div className="bg-white/[0.03] rounded-xl p-3">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">When</p>
                            <p className="text-xs text-zinc-300">{catalog.timing}</p>
                          </div>
                        </div>

                        {/* Benefits */}
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Benefits</p>
                          <ul className="space-y-1.5">
                            {catalog.benefits.map((b, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className={cn('mt-0.5 w-1.5 h-1.5 rounded-full shrink-0', colors?.bg, colors?.text, 'bg-current')} />
                                <span className="text-xs text-zinc-400 leading-relaxed">{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Mechanism */}
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1.5">How it works</p>
                          <p className="text-xs text-zinc-500 leading-relaxed">{catalog.mechanism}</p>
                        </div>

                        {/* Timing rationale */}
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1.5">Why this timing</p>
                          <p className="text-xs text-zinc-500 leading-relaxed">{catalog.timing_rationale}</p>
                        </div>

                        {/* Interactions */}
                        {catalog.interactions && (
                          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3">
                            <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold mb-1">Notes & Interactions</p>
                            <p className="text-xs text-amber-200/60 leading-relaxed">{catalog.interactions}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
              </div>
            </div>
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
