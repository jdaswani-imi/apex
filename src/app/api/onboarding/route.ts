import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ONBOARDING_SECTIONS = [
  'physical', 'lifestyle_ext', 'training_ext', 'nutrition_ext',
  'supplements_ext', 'sleep_ext', 'skincare', 'hair',
  'mental', 'travel', 'tech_prefs', 'coaching',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_onboarding')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? {})
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { section, data, current_step, completed } = body

  if (section && !ONBOARDING_SECTIONS.includes(section)) {
    return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (section) payload[section] = data
  if (current_step !== undefined) payload.current_step = current_step
  if (completed !== undefined) payload.completed = completed

  const { error } = await supabase
    .from('user_onboarding')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mirror core fields to existing settings tables
  if (section === 'physical' && data) {
    if (data.sex === 'Female' && data.last_period_date) {
      await supabase.from('menstrual_cycles').upsert({
        user_id: user.id,
        period_start_date: data.last_period_date,
        cycle_length_days: data.avg_cycle_length_days ?? 28,
      }, { onConflict: 'user_id,period_start_date' })
    }

    await supabase.from('user_profile').upsert({
      user_id: user.id,
      ...(data.location && { location: data.location }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    await supabase.from('user_goals').upsert({
      user_id: user.id,
      ...(data.current_weight_kg && { current_weight_kg: data.current_weight_kg }),
      ...(data.target_weight_kg && { target_weight_kg: data.target_weight_kg }),
      ...(data.body_fat_pct && { body_fat_pct: data.body_fat_pct }),
    }, { onConflict: 'user_id' })
  }

  if (section === 'lifestyle_ext' && data) {
    await supabase.from('user_lifestyle').upsert({
      user_id: user.id,
      ...(data.wake_time_weekday && { wake_time_weekday: data.wake_time_weekday }),
      ...(data.wake_time_weekend && { wake_time_weekend: data.wake_time_weekend }),
      ...(data.sleep_target_weeknight && { sleep_target_weeknight: data.sleep_target_weeknight }),
      ...(data.social_night && { social_night: data.social_night }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  if (section === 'nutrition_ext' && data) {
    await supabase.from('user_lifestyle').upsert({
      user_id: user.id,
      ...(data.diet_type && { diet_type: data.diet_type }),
      ...(data.dislikes && { dislikes: data.dislikes }),
      ...(data.coffee_cutoff && { coffee_cutoff: data.coffee_cutoff }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  if (section === 'training_ext' && data) {
    await supabase.from('user_training').upsert({
      user_id: user.id,
      ...(data.gym_name && { gym_name: data.gym_name }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('user_onboarding').delete().eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
