import { whoopFetch, whoopFetchAll } from './client'
import { createClient } from '@/lib/supabase/server'

const MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

export async function syncWhoopData(userId: string, days = 7, force = false) {
  const supabase = await createClient()

  // Enforce minimum sync interval to protect rate limits
  if (!force) {
    const { data: tokenRow } = await supabase
      .from('whoop_tokens')
      .select('last_synced_at')
      .eq('user_id', userId)
      .single()

    if (tokenRow?.last_synced_at) {
      const elapsed = Date.now() - new Date(tokenRow.last_synced_at).getTime()
      if (elapsed < MIN_SYNC_INTERVAL_MS) {
        const waitSec = Math.ceil((MIN_SYNC_INTERVAL_MS - elapsed) / 1000)
        return { skipped: true, retryAfterSeconds: waitSec }
      }
    }
  }

  const start = new Date()
  start.setDate(start.getDate() - days)
  const startStr = start.toISOString()

  const results = {
    profile: false,
    body: false,
    recovery: 0,
    sleep: 0,
    cycles: 0,
    workouts: 0,
    errors: [] as string[],
  }

  // Sync profile (1 request)
  try {
    const profile = await whoopFetch(userId, '/v2/user/profile/basic')
    await supabase.from('whoop_profile').upsert({
      user_id: userId,
      whoop_user_id: profile.user_id,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      synced_at: new Date().toISOString(),
    })
    results.profile = true
  } catch (e: any) {
    results.errors.push(`profile: ${e.message}`)
  }

  // Sync body measurements (1 request)
  try {
    const body = await whoopFetch(userId, '/v2/user/measurement/body')
    await supabase.from('whoop_body').upsert({
      user_id: userId,
      height_meter: body.height_meter,
      weight_kilogram: body.weight_kilogram,
      max_heart_rate: body.max_heart_rate,
      synced_at: new Date().toISOString(),
    })
    results.body = true
  } catch (e: any) {
    results.errors.push(`body: ${e.message}`)
  }

  // Sync recovery (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/recovery', { start: startStr })
    for (const record of records) {
      if (record.score_state !== 'SCORED') continue
      const date = new Date(record.created_at).toISOString().split('T')[0]
      await supabase.from('whoop_recovery').upsert({
        user_id: userId,
        date,
        cycle_id: record.cycle_id,
        recovery_score: Math.round(record.score.recovery_score),
        hrv_rmssd_milli: record.score.hrv_rmssd_milli,
        resting_heart_rate: Math.round(record.score.resting_heart_rate),
        spo2_percentage: record.score.spo2_percentage ?? null,
        skin_temp_celsius: record.score.skin_temp_celsius ?? null,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })
      results.recovery++
    }
  } catch (e: any) {
    results.errors.push(`recovery: ${e.message}`)
  }

  // Sync sleep (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/activity/sleep', { start: startStr })
    for (const record of records) {
      if (record.score_state !== 'SCORED') continue
      const date = new Date(record.start).toISOString().split('T')[0]
      const score = record.score
      const stages = score.stage_summary
      const needed = score.sleep_needed

      const durationMs = stages.total_in_bed_time_milli - stages.total_awake_time_milli
      const durationHrs = Math.round((durationMs / 3600000) * 10) / 10

      await supabase.from('whoop_sleep').upsert({
        user_id: userId,
        date,
        sleep_uuid: record.id,
        start_time: record.start,
        end_time: record.end,
        duration_hrs: durationHrs,
        deep_sleep_min: Math.round(stages.total_slow_wave_sleep_time_milli / 60000),
        rem_min: Math.round(stages.total_rem_sleep_time_milli / 60000),
        light_sleep_min: Math.round(stages.total_light_sleep_time_milli / 60000),
        awake_min: Math.round(stages.total_awake_time_milli / 60000),
        sleep_performance_pct: score.sleep_performance_percentage
          ? Math.round(score.sleep_performance_percentage) : null,
        sleep_efficiency_pct: score.sleep_efficiency_percentage ?? null,
        sleep_consistency_pct: score.sleep_consistency_percentage
          ? Math.round(score.sleep_consistency_percentage) : null,
        respiratory_rate: score.respiratory_rate ?? null,
        disturbance_count: score.disturbances ?? null,
        sleep_needed_baseline_min: needed?.baseline_milli
          ? Math.round(needed.baseline_milli / 60000) : null,
        sleep_needed_from_strain_min: needed?.need_from_recent_strain_milli
          ? Math.round(needed.need_from_recent_strain_milli / 60000) : null,
        sleep_needed_from_debt_min: needed?.need_from_sleep_debt_milli
          ? Math.round(needed.need_from_sleep_debt_milli / 60000) : null,
        sleep_needed_from_nap_min: needed?.need_from_recent_nap_milli
          ? Math.round(needed.need_from_recent_nap_milli / 60000) : null,
        nap: record.nap,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,sleep_uuid' })
      results.sleep++
    }
  } catch (e: any) {
    results.errors.push(`sleep: ${e.message}`)
  }

  // Sync cycles (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/cycle', { start: startStr })
    for (const record of records) {
      if (record.score_state !== 'SCORED') continue
      const date = new Date(record.start).toISOString().split('T')[0]
      const zones = record.score.zone_durations
      await supabase.from('whoop_cycles').upsert({
        user_id: userId,
        date,
        cycle_id: record.id,
        strain: record.score.strain,
        avg_heart_rate: record.score.average_heart_rate,
        max_heart_rate: record.score.max_heart_rate,
        kilojoule: record.score.kilojoule,
        percent_recorded: record.score.percent_recorded ?? null,
        zone_0_min: zones ? Math.round(zones.zone_zero_milli / 60000) : null,
        zone_1_min: zones ? Math.round(zones.zone_one_milli / 60000) : null,
        zone_2_min: zones ? Math.round(zones.zone_two_milli / 60000) : null,
        zone_3_min: zones ? Math.round(zones.zone_three_milli / 60000) : null,
        zone_4_min: zones ? Math.round(zones.zone_four_milli / 60000) : null,
        zone_5_min: zones ? Math.round(zones.zone_five_milli / 60000) : null,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })
      results.cycles++
    }
  } catch (e: any) {
    results.errors.push(`cycles: ${e.message}`)
  }

  // Sync workouts (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/activity/workout', { start: startStr })
    for (const record of records) {
      if (record.score_state !== 'SCORED') continue
      const zones = record.score.zone_durations
      await supabase.from('whoop_workouts').upsert({
        user_id: userId,
        workout_uuid: record.id,
        start_time: record.start,
        end_time: record.end,
        sport_id: record.sport_id ?? null,
        sport_name: record.sport_name,
        strain: record.score.strain,
        avg_heart_rate: record.score.average_heart_rate,
        max_heart_rate: record.score.max_heart_rate,
        kilojoule: record.score.kilojoule,
        percent_recorded: record.score.percent_recorded ?? null,
        zone_0_min: Math.round(zones.zone_zero_milli / 60000),
        zone_1_min: Math.round(zones.zone_one_milli / 60000),
        zone_2_min: Math.round(zones.zone_two_milli / 60000),
        zone_3_min: Math.round(zones.zone_three_milli / 60000),
        zone_4_min: Math.round(zones.zone_four_milli / 60000),
        zone_5_min: Math.round(zones.zone_five_milli / 60000),
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,workout_uuid' })
      results.workouts++
    }
  } catch (e: any) {
    results.errors.push(`workouts: ${e.message}`)
  }

  // Record sync time
  await supabase.from('whoop_tokens')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)

  return results
}
