import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const EXERCISEDB_BASE = 'https://oss.exercisedb.dev/api/v1'
const BATCH_SIZE = 100

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: localExercises } = await supabase
    .from('exercise_library')
    .select('id, name')
    .is('gif_url', null)

  if (!localExercises || localExercises.length === 0) {
    return NextResponse.json({ synced: 0, message: 'All exercises already have media' })
  }

  const nameMap = new Map<string, string>()
  for (const ex of localExercises) {
    nameMap.set(ex.name.toLowerCase().trim(), ex.id)
  }

  let synced = 0
  let cursor: string | null = null
  let hasMore = true

  while (hasMore && nameMap.size > 0) {
    let data: Record<string, unknown>[] = []
    let nextCursor: string | null = null
    try {
      const endpoint: string = cursor
        ? `${EXERCISEDB_BASE}/exercises?limit=${BATCH_SIZE}&cursor=${cursor}`
        : `${EXERCISEDB_BASE}/exercises?limit=${BATCH_SIZE}`
      const res: Response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) break
      const json = await res.json() as { data?: Record<string, unknown>[]; meta?: { nextCursor?: string; hasNextPage?: boolean } }
      data = json.data ?? []
      nextCursor = json.meta?.nextCursor ?? null
      hasMore = json.meta?.hasNextPage ?? false
    } catch {
      break
    }

    if (!data.length) break
    cursor = nextCursor

    const updates: { id: string; gif_url: string; gif_url_female: string }[] = []

    for (const ex of data) {
      const normalizedName = ((ex.name as string | null | undefined) ?? '').toLowerCase().trim()
      const localId = nameMap.get(normalizedName)
      if (!localId) continue

      const gif = (ex.gifUrl as string | null | undefined) ?? null
      if (!gif) continue

      updates.push({ id: localId, gif_url: gif, gif_url_female: gif })
      nameMap.delete(normalizedName)
    }

    if (updates.length > 0) {
      await supabase.from('exercise_library').upsert(updates)
      synced += updates.length
    }
  }

  return NextResponse.json({ synced, remaining: nameMap.size })
}
