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

  // Verify the session belongs to the authenticated user before inserting
  const { data: session } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('id', body.session_id)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Strip unknown fields to prevent unintended column writes
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_EXERCISE_FIELDS.has(k)) safe[k] = v
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert(safe)
    .select()
    .single()

  if (error) {
    console.error('Failed to insert exercise:', error.message)
    return NextResponse.json({ error: 'Failed to save exercise' }, { status: 500 })
  }

  if (body.is_pr && body.name) {
    // Exact (case-insensitive) match on the canonical exercise name. A LIKE with
    // %name% wildcards let a one-character or %-containing name overwrite every
    // matching baseline row.
    const { error: baselineError } = await supabase
      .from('exercise_baselines')
      .update({
        current_weight_kg: body.weight_kg,
        current_reps: body.reps,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('exercise_name', body.name)
    if (baselineError) {
      console.error('Failed to update exercise baseline:', baselineError.message)
    }
  }

  return NextResponse.json(data ?? null)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Verify the exercise belongs to a session owned by this user before deleting.
  const { data: row } = await supabase
    .from('exercises')
    .select('id, session_id, training_sessions!inner(user_id)')
    .eq('id', id)
    .eq('training_sessions.user_id', user.id)
    .single()

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) {
    console.error('Failed to delete exercise:', error.message)
    return NextResponse.json({ error: 'Failed to delete exercise' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
