'use client'

import { useState } from 'react'
import { Sparkles, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Page = 'food' | 'today' | 'training' | 'sleep' | 'supplements'

export function AITipButton({ page, className }: { page: Page; className?: string }) {
  const [tip, setTip] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function handlePress() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (tip) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
      })
      const data = await res.json() as { tip: string }
      setTip(data.tip)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <button
        onClick={handlePress}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-150 active:scale-[0.97]',
          open
            ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
            : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/15',
        )}
      >
        <Sparkles size={11} />
        <span className="text-[10px] font-bold uppercase tracking-widest">AI Tip</span>
      </button>

      {open && (
        <div className="mt-2.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3.5">
          <div className="flex items-start gap-2.5">
            <Sparkles size={13} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-xs">Reading your data…</span>
                </div>
              ) : (
                <p className="text-sm text-zinc-200 leading-relaxed">{tip}</p>
              )}
            </div>
            {!loading && (
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-700 hover:text-zinc-500 transition-colors shrink-0 mt-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
