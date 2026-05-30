'use client'

import { useState, useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function renderTip(text: string) {
  return text.split('\n').filter(Boolean).map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g)
    return (
      <p key={i} className={i > 0 ? 'mt-2' : ''}>
        {parts.map((part, j) =>
          j % 2 === 1
            ? <span key={j} className="text-amber-500">{part}</span>
            : part
        )}
      </p>
    )
  })
}

type Page = 'food' | 'today' | 'training' | 'sleep' | 'supplements'

export function AITipButton({ page, className }: { page: Page; className?: string }) {
  const [tip, setTip] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const dismissKey = `apex_ai_tip_dismiss_${page}_${today}`

  useEffect(() => {
    try {
      if (localStorage.getItem(dismissKey)) {
        setVisible(false)
        setLoading(false)
        return
      }
    } catch {}

    let cancelled = false
    setLoading(true)
    fetch('/api/ai-tip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
    })
      .then(r => r.json())
      .then((data: { tip: string }) => {
        if (!cancelled) setTip(data.tip)
      })
      .catch(() => {
        if (!cancelled) setTip('Rest day: focus on hitting your protein target across 4 meals to protect muscle during your deficit, and aim for 7–8 hours sleep to maximise recovery.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function handleDismiss() {
    try { localStorage.setItem(dismissKey, '1') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={cn('bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3.5', className)}>
      <div className="flex items-start gap-2.5">
        <Sparkles size={13} className="text-orange-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-orange-400/70 uppercase tracking-widest mb-1.5">AI Tip</p>
          {loading ? (
            <div className="space-y-2 py-0.5 w-full">
              <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-4/5" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-3/5" />
            </div>
          ) : (
            <div className="text-sm text-foreground/75 leading-relaxed">{renderTip(tip!)}</div>
          )}
        </div>
        {!loading && (
          <button
            onClick={handleDismiss}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
