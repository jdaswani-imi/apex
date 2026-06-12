import { createClient } from '@/lib/supabase/server'
import { todayLocal } from '@/lib/date'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { feeling_recovery, feeling_sleep_quality, feeling_sleep_hours, feeling_strain } = body

  const today = todayLocal()

  // Only write the fields that were actually provided. Writing `?? null` for
  // omitted fields would wipe previously-saved values on a partial check-in.
  const row: Record<string, unknown> = { user_id: user.id, date: today }
  if (feeling_recovery !== undefined) row.feeling_recovery = feeling_recovery
  if (feeling_sleep_quality !== undefined) row.feeling_sleep_quality = feeling_sleep_quality
  if (feeling_sleep_hours !== undefined) row.feeling_sleep_hours = feeling_sleep_hours
  if (feeling_strain !== undefined) row.feeling_strain = feeling_strain

  const { error } = await supabase
    .from('daily_logs')
    .upsert(row, { onConflict: 'user_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
