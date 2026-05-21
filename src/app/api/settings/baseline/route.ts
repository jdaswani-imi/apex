import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_BASELINE_FIELDS = new Set([
  'exercise_name', 'session_type', 'current_weight_kg', 'current_reps', 'current_sets',
  'target_weight_kg', 'target_reps', 'notes',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...rest } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Strip unknown fields to prevent unintended column writes
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rest)) {
    if (ALLOWED_BASELINE_FIELDS.has(k)) safe[k] = v
  }

  await supabase
    .from('exercise_baselines')
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
