import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('user_profile')
    .select('user_id')
    .eq('api_token', token)
    .single()

  if (!profile) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const body = await request.json()
  const { date, steps } = body

  if (!date || typeof steps !== 'number') {
    return NextResponse.json({ error: 'date and steps are required' }, { status: 400 })
  }

  const { error } = await supabase.from('daily_steps').upsert({
    user_id: profile.user_id,
    date,
    steps,
    source: 'apple_health',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, date, steps })
}
