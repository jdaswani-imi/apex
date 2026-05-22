import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { invalidateUserAICaches, invalidateUserSettingsCache } from '@/lib/ai-cache'

const ONBOARDING_SECTIONS = [
  'interests', 'physical', 'lifestyle_ext', 'training_ext', 'nutrition_ext',
  'supplements_ext', 'sleep_ext', 'skincare', 'hair',
  'mental', 'travel', 'tech_prefs', 'coaching',
]

const MAX_STEPS = 20
const MAX_PAYLOAD_BYTES = 102_400

// Compute average of "HH:MM" strings for the given days from the wake_times map.
function avgWakeTime(days: string[], wakeTimes: Record<string, string>): string | null {
  const times = days.map(d => wakeTimes[d]).filter(Boolean)
  if (times.length === 0) return null
  const mins = times.map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + m })
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`
}

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
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { section, data, current_step, completed } = body

  if (section && !ONBOARDING_SECTIONS.includes(section)) {
    return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
  }

  if (section === 'physical' && data) {
    const missing = ['primary_goal', 'sex'].filter(f => !data[f])
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }
  }

  // Fetch old physical data BEFORE the upsert so we can detect period date changes
  let oldPeriodDate: string | undefined
  if (section === 'physical') {
    const { data: existing } = await supabase
      .from('user_onboarding')
      .select('physical')
      .eq('user_id', user.id)
      .maybeSingle()
    oldPeriodDate = (existing?.physical as Record<string, unknown> | null)?.last_period_date as string | undefined
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  if (section) payload[section] = data
  if (current_step !== undefined) payload.current_step = Math.max(0, Math.min(Number(current_step) || 0, MAX_STEPS))
  if (completed !== undefined) payload.completed = completed

  const { error } = await supabase
    .from('user_onboarding')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bust AI caches so the next brief/tip/chat picks up the updated profile immediately
  await Promise.all([
    invalidateUserAICaches(user.id),
    invalidateUserSettingsCache(user.id),
  ])

  // ── Mirror physical → user_profile, user_goals, menstrual_cycles ──────────
  if (section === 'physical' && data) {
    if (data.sex === 'Female' && data.last_period_date) {
      // Remove stale onboarding cycle if the date changed
      if (oldPeriodDate && oldPeriodDate !== data.last_period_date) {
        await supabase
          .from('menstrual_cycles')
          .delete()
          .eq('user_id', user.id)
          .eq('period_start_date', oldPeriodDate)
      }
      const { error: cycleErr } = await supabase.from('menstrual_cycles').upsert({
        user_id: user.id,
        period_start_date: data.last_period_date,
        cycle_length_days: data.avg_cycle_length_days ?? 28,
      }, { onConflict: 'user_id,period_start_date' })
      if (cycleErr) console.error('[onboarding] menstrual_cycles upsert failed:', cycleErr.message)
    }

    const { error: profileErr } = await supabase.from('user_profile').upsert({
      user_id: user.id,
      ...(data.age && { age: data.age }),
      ...(data.height_cm && { height_cm: data.height_cm }),
      // Normalise sex → gender in lowercase to match app-wide convention
      ...(data.sex && { gender: (data.sex as string).toLowerCase() }),
      ...(data.location && { location: data.location }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (profileErr) console.error('[onboarding] user_profile upsert failed:', profileErr.message)

    const { error: goalsErr } = await supabase.from('user_goals').upsert({
      user_id: user.id,
      ...(data.current_weight_kg && { current_weight_kg: data.current_weight_kg }),
      ...(data.target_weight_kg && { target_weight_kg: data.target_weight_kg }),
      ...(data.body_fat_pct && { body_fat_pct: data.body_fat_pct }),
      ...(data.target_event_name && { target_event_name: data.target_event_name }),
      ...(data.target_event_date && { target_event_date: data.target_event_date }),
    }, { onConflict: 'user_id' })
    if (goalsErr) console.error('[onboarding] user_goals upsert failed:', goalsErr.message)
  }

  // ── Mirror lifestyle_ext → user_lifestyle ─────────────────────────────────
  if (section === 'lifestyle_ext' && data) {
    const wakeTimes: Record<string, string> = (data.wake_times as Record<string, string>) ?? {}
    const weekdayDays: string[] = (data.weekday_days as string[]) ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const weekendDays = ALL_DAYS.filter(d => !weekdayDays.includes(d))
    const wake_time_weekday = avgWakeTime(weekdayDays, wakeTimes)
    const wake_time_weekend = avgWakeTime(weekendDays, wakeTimes)

    const { error: lifestyleErr } = await supabase.from('user_lifestyle').upsert({
      user_id: user.id,
      ...(wake_time_weekday && { wake_time_weekday }),
      ...(wake_time_weekend && { wake_time_weekend }),
      ...(data.sleep_target_weeknight && { sleep_target_weeknight: data.sleep_target_weeknight }),
      ...(data.social_night && { social_night: (data.social_night as string).toLowerCase() }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (lifestyleErr) console.error('[onboarding] user_lifestyle upsert failed (lifestyle):', lifestyleErr.message)
  }

  // ── Mirror nutrition_ext → user_lifestyle ─────────────────────────────────
  if (section === 'nutrition_ext' && data) {
    const { error: nutritionErr } = await supabase.from('user_lifestyle').upsert({
      user_id: user.id,
      ...(data.diet_type && { diet_type: data.diet_type }),
      // Form stores this as dislikes_list
      ...(data.dislikes_list && { dislikes: data.dislikes_list }),
      ...(data.coffee_cutoff && { coffee_cutoff: data.coffee_cutoff }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (nutritionErr) console.error('[onboarding] user_lifestyle upsert failed (nutrition):', nutritionErr.message)
  }

  // ── Mirror training_ext → user_training ───────────────────────────────────
  if (section === 'training_ext' && data) {
    const { error: trainingErr } = await supabase.from('user_training').upsert({
      user_id: user.id,
      ...(data.gym_name && { gym_name: data.gym_name }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (trainingErr) console.error('[onboarding] user_training upsert failed:', trainingErr.message)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch current data to know which mirrored rows to clean up
  const { data: onboarding } = await supabase
    .from('user_onboarding')
    .select('physical')
    .eq('user_id', user.id)
    .maybeSingle()

  const physical = onboarding?.physical as Record<string, unknown> | null

  await supabase.from('user_onboarding').delete().eq('user_id', user.id)

  // Clear only the fields onboarding writes, leaving other profile data intact
  await Promise.all([
    supabase.from('user_profile')
      .update({ age: null, height_cm: null, gender: null, location: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id),
    supabase.from('user_goals')
      .update({ current_weight_kg: null, target_weight_kg: null, body_fat_pct: null, target_event_name: null, target_event_date: null })
      .eq('user_id', user.id),
    supabase.from('user_lifestyle')
      .update({ wake_time_weekday: null, wake_time_weekend: null, sleep_target_weeknight: null, social_night: null, diet_type: null, dislikes: null, coffee_cutoff: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id),
    supabase.from('user_training')
      .update({ gym_name: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id),
    // Remove the specific menstrual cycle row created during onboarding
    ...(physical?.last_period_date
      ? [supabase.from('menstrual_cycles').delete().eq('user_id', user.id).eq('period_start_date', physical.last_period_date as string)]
      : []),
  ])

  return NextResponse.json({ success: true })
}
