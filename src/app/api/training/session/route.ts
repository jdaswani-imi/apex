import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Allowed columns for training_sessions insert/update
const ALLOWED_SESSION_FIELDS = new Set([
  'date', 'session_type', 'gym', 'duration_min', 'volume_kg',
  'prs', 'whoop_strain', 'notes', 'template_id', 'started_at', 'finished_at',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.date || !body.session_type) {
    return NextResponse.json({ error: 'date and session_type are required' }, { status: 400 })
  }

  // Strip unknown fields before inserting to avoid unintended data writes
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_SESSION_FIELDS.has(k)) safe[k] = v
  }

  const { data } = await supabase
    .from('training_sessions')
    .insert({ user_id: user.id, ...safe })
    .select()
    .single()

  return NextResponse.json(data)
}
