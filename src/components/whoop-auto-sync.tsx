'use client'

import { useEffect } from 'react'
import { todayLocal } from '@/lib/date'
import { useRouter } from 'next/navigation'

export function WhoopAutoSync() {
  const router = useRouter()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    async function maybeSync() {
      try {
        const res = await fetch('/api/whoop/status', { signal })
        if (!res.ok) return
        const status = await res.json()

        if (!status.connected) return
        if (status.expired && !status.canRefresh) return

        const today = todayLocal()
        const lastSynced = status.lastSyncedAt
          ? new Date(status.lastSyncedAt).toISOString().split('T')[0]
          : null

        if (lastSynced === today) return

        await fetch('/api/whoop/sync', { method: 'POST', signal })
        router.refresh()
      } catch {
        // silent — auto-sync is best-effort
      }
    }

    maybeSync()
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
