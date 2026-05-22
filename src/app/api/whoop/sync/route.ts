import { createClient } from '@/lib/supabase/server'
import { syncWhoopData } from '@/lib/whoop/sync'
import { NextResponse } from 'next/server'
import { invalidateUserAICaches, invalidateUserWhoopCache } from '@/lib/ai-cache'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const days = body.days ?? 7

  const results = await syncWhoopData(user.id, days)
  await Promise.all([
    invalidateUserAICaches(user.id),
    invalidateUserWhoopCache(user.id),
  ])

  return NextResponse.json({ success: true, results })
}
