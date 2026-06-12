import { createClient } from '@/lib/supabase/server'
import { getFullUserContext } from '@/lib/db'
import { NextResponse } from 'next/server'
import { invalidateUserSettingsCache, invalidateUserAICaches } from '@/lib/ai-cache'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getFullUserContext()
  return NextResponse.json(ctx)
}

// Per-table column allowlists. Anything not listed (user_id, api_token, id,
// created_at, …) is stripped so a crafted body can't escalate privileges or
// overwrite credentials like user_profile.api_token.
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  user_profile: new Set(['name', 'age', 'gender', 'height_cm', 'location', 'timezone']),
  user_goals: new Set([
    'start_weight_kg', 'target_weight_kg', 'current_weight_kg', 'body_fat_pct',
    'daily_protein_target_g', 'daily_calorie_target', 'daily_steps_target',
    'target_event_name', 'target_event_date', 'target_event_location', 'notes',
    'program_start_date',
  ]),
  user_training: new Set([
    'training_split', 'gym_name', 'smith_machine_bar_kg', 'protein_target_g',
    'cardio_target_duration_min', 'cardio_target_level', 'notes',
  ]),
  user_lifestyle: new Set([
    'diet_type', 'dietary_restrictions', 'dislikes', 'wake_time_weekday',
    'wake_time_weekend', 'sleep_target_weeknight', 'sleep_target_sunday',
    'coffee_cutoff', 'work_start_weekday', 'work_end_weekday',
    'work_start_saturday', 'work_end_saturday', 'social_night', 'notes',
  ]),
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { table, data } = await request.json()

  const allowedFields = ALLOWED_FIELDS[table]
  if (!allowedFields) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  // Strip unknown fields, then set user_id/updated_at last so the body can't
  // override them.
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data ?? {})) {
    if (allowedFields.has(k)) safe[k] = v
  }

  const { error } = await supabase
    .from(table)
    .upsert({ ...safe, user_id: user.id, updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    invalidateUserSettingsCache(user.id),
    invalidateUserAICaches(user.id),
  ])

  return NextResponse.json({ success: true })
}
