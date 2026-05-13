import { createClient } from '@/lib/supabase/server'
import { syncWhoopData } from '@/lib/whoop/sync'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const days = body.days ?? 7

  const results = await syncWhoopData(user.id, days)

  if ('skipped' in results && results.skipped) {
    return NextResponse.json(
      { error: 'Synced too recently', retryAfterSeconds: results.retryAfterSeconds },
      { status: 429 }
    )
  }

  return NextResponse.json({ success: true, results })
}
