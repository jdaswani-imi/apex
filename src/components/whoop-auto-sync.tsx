'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function WhoopAutoSync() {
  const router = useRouter()

  useEffect(() => {
    async function maybeSync() {
      try {
        const res = await fetch('/api/whoop/status')
        if (!res.ok) return
        const status = await res.json()

        if (!status.connected || status.expired) return

        const today = new Date().toISOString().split('T')[0]
        const lastSynced = status.lastSyncedAt
          ? new Date(status.lastSyncedAt).toISOString().split('T')[0]
          : null

        if (lastSynced === today) return

        await fetch('/api/whoop/sync', { method: 'POST' })
        router.refresh()
      } catch {
        // silent — auto-sync is best-effort
      }
    }

    maybeSync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
