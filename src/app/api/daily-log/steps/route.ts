import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date, steps } = body

  if (!date || typeof steps !== 'number' || steps < 0) {
    return NextResponse.json({ error: 'date and steps are required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('daily_logs')
    .upsert({ user_id: user.id, date, steps }, { onConflict: 'user_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, date, steps })
}
