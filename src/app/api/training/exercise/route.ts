import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Allowed columns for exercises insert
const ALLOWED_EXERCISE_FIELDS = new Set([
  'session_id', 'name', 'set_number', 'set_type', 'weight_kg', 'reps', 'sets',
  'is_pr', 'is_completed', 'notes', 'rest_seconds', 'duration_sec', 'distance_m',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.session_id || !body.name) {
    return NextResponse.json({ error: 'session_id and name are required' }, { status: 400 })
  }

  // Strip unknown fields to prevent unintended column writes
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_EXERCISE_FIELDS.has(k)) safe[k] = v
  }

  const { data } = await supabase
    .from('exercises')
    .insert(safe)
    .select()
    .single()

  if (body.is_pr && body.name) {
    await supabase
      .from('exercise_baselines')
      .update({
        current_weight_kg: body.weight_kg,
        current_reps: body.reps,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .ilike('exercise_name', `%${body.name}%`)
  }

  return NextResponse.json(data)
}
