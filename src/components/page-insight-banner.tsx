'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import type { MorningIntelligence } from '@/app/api/intelligence/morning/route'

const CACHE_KEY_PREFIX = 'apex_morning_v1_'
const DISMISS_KEY_PREFIX = 'apex_page_insight_dismiss_v1_'

export type InsightPage = 'food' | 'sleep' | 'supplements' | 'training'

interface Props {
  page: InsightPage
}

export function PageInsightBanner({ page }: Props) {
  const [insight, setInsight] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `${CACHE_KEY_PREFIX}${today}`
  const dismissKey = `${DISMISS_KEY_PREFIX}${page}_${today}`

  useEffect(() => {
    // Check if dismissed for this page today
    try {
      if (localStorage.getItem(dismissKey)) {
        setDismissed(true)
        return
      }
    } catch {}

    // Try to read from cached morning data first
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached) as MorningIntelligence
        const text = data.page_insights?.[page]
        if (text) { setInsight(text); return }
      }
    } catch {}

    // Fetch if not cached
    fetch('/api/intelligence/morning')
      .then(r => r.json())
      .then((data: MorningIntelligence) => {
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch {}
        const text = data.page_insights?.[page]
        if (text) setInsight(text)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, today])

  function handleDismiss() {
    try { localStorage.setItem(dismissKey, '1') } catch {}
    setDismissed(true)
  }

  if (dismissed || !insight) return null

  return (
    <div className="flex items-start gap-2.5 bg-orange-500/[0.06] border border-orange-500/15 rounded-xl px-3 py-2.5">
      <Sparkles size={12} className="text-orange-500 shrink-0 mt-0.5" />
      <p className="text-xs text-zinc-400 leading-relaxed flex-1">{insight}</p>
      <button
        onClick={handleDismiss}
        className="text-zinc-700 hover:text-zinc-500 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={11} />
      </button>
    </div>
  )
}
