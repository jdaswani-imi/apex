import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('training_sessions')
    .select('*, exercises(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete exercises first (no CASCADE on FK)
  await supabase.from('exercises').delete().eq('session_id', id)
  await supabase.from('training_sessions').delete().eq('id', id).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}

// Allowed columns for training_sessions update
const ALLOWED_SESSION_UPDATE_FIELDS = new Set([
  'date', 'session_type', 'gym', 'duration_min', 'volume_kg',
  'prs', 'whoop_strain', 'notes', 'finished_at',
])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Strip unknown fields to prevent unintended column writes
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_SESSION_UPDATE_FIELDS.has(k)) safe[k] = v
  }

  const { data } = await supabase
    .from('training_sessions')
    .update(safe)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  return NextResponse.json(data)
}
