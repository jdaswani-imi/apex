import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data } = await supabase
    .from('exercise_baselines')
    .select('exercise_name, current_weight_kg, current_reps, current_sets, target_weight_kg, target_reps, notes, updated_at')
    .eq('user_id', user.id)
    .order('exercise_name')

  return NextResponse.json(data ?? [])
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Array<{
    exercise_name: string
    current_weight_kg: number
    current_reps: number
    current_sets?: number
  }>

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const rows = body.map(b => ({
    user_id: user.id,
    exercise_name: b.exercise_name,
    session_type: 'strength',
    current_weight_kg: b.current_weight_kg,
    current_reps: b.current_reps,
    current_sets: b.current_sets ?? 3,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('exercise_baselines')
    .upsert(rows, { onConflict: 'user_id,exercise_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: rows.length })
}
