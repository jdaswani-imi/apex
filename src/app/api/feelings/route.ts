import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { feeling_recovery, feeling_sleep_quality, feeling_sleep_hours, feeling_strain } = body

  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('daily_logs')
    .upsert(
      {
        user_id: user.id,
        date: today,
        feeling_recovery: feeling_recovery ?? null,
        feeling_sleep_quality: feeling_sleep_quality ?? null,
        feeling_sleep_hours: feeling_sleep_hours ?? null,
        feeling_strain: feeling_strain ?? null,
      },
      { onConflict: 'user_id,date' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
