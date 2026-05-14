import { whoopFetch, whoopFetchAll } from './client'
import { createClient } from '@/lib/supabase/server'

export async function syncWhoopData(userId: string, days = 7) {
  const supabase = await createClient()

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
    const profile = await whoopFetch(userId, '/v2/user/profile/basic') as Record<string, unknown>
    await supabase.from('whoop_profile').upsert({
      user_id: userId,
      whoop_user_id: profile.user_id,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      synced_at: new Date().toISOString(),
    })
    results.profile = true
  } catch (e: unknown) {
    results.errors.push(`profile: ${(e as Error).message}`)
  }

  // Sync body measurements (1 request)
  try {
    const body = await whoopFetch(userId, '/v2/user/measurement/body') as Record<string, unknown>
    await supabase.from('whoop_body').upsert({
      user_id: userId,
      height_meter: body.height_meter,
      weight_kilogram: body.weight_kilogram,
      max_heart_rate: body.max_heart_rate,
      synced_at: new Date().toISOString(),
    })
    results.body = true
  } catch (e: unknown) {
    results.errors.push(`body: ${(e as Error).message}`)
  }

  // Sync recovery (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/recovery', { start: startStr })
    for (const record of records as Record<string, unknown>[]) {
      if (record.score_state !== 'SCORED') continue
      const score = record.score as Record<string, unknown>
      const date = new Date(record.created_at as string).toISOString().split('T')[0]
      await supabase.from('whoop_recovery').upsert({
        user_id: userId,
        date,
        cycle_id: record.cycle_id,
        recovery_score: Math.round(score.recovery_score as number),
        hrv_rmssd_milli: score.hrv_rmssd_milli,
        resting_heart_rate: Math.round(score.resting_heart_rate as number),
        spo2_percentage: score.spo2_percentage ?? null,
        skin_temp_celsius: score.skin_temp_celsius ?? null,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })
      results.recovery++
    }
  } catch (e: unknown) {
    results.errors.push(`recovery: ${(e as Error).message}`)
  }

  // Sync sleep (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/activity/sleep', { start: startStr })
    for (const record of records as Record<string, unknown>[]) {
      if (!record.score) continue
      const date = new Date(record.start as string).toISOString().split('T')[0]
      const score = record.score as Record<string, unknown>
      const stages = score.stage_summary as Record<string, number>
      const needed = score.sleep_needed as Record<string, number> | null

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
          ? Math.round(score.sleep_performance_percentage as number) : null,
        sleep_efficiency_pct: score.sleep_efficiency_percentage ?? null,
        sleep_consistency_pct: score.sleep_consistency_percentage
          ? Math.round(score.sleep_consistency_percentage as number) : null,
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
  } catch (e: unknown) {
    results.errors.push(`sleep: ${(e as Error).message}`)
  }

  // Sync cycles (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/cycle', { start: startStr })
    for (const record of records as Record<string, unknown>[]) {
      if (record.score_state !== 'SCORED') continue
      const date = new Date(record.start as string).toISOString().split('T')[0]
      const score = record.score as Record<string, unknown>
      const zones = score.zone_durations as Record<string, number> | null
      await supabase.from('whoop_cycles').upsert({
        user_id: userId,
        date,
        cycle_id: record.id,
        strain: score.strain,
        avg_heart_rate: score.average_heart_rate,
        max_heart_rate: score.max_heart_rate,
        kilojoule: score.kilojoule,
        percent_recorded: score.percent_recorded ?? null,
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
  } catch (e: unknown) {
    results.errors.push(`cycles: ${(e as Error).message}`)
  }

  // Sync workouts (paginated, ≤10 pages)
  try {
    const records = await whoopFetchAll(userId, '/v2/activity/workout', { start: startStr })
    for (const record of records as Record<string, unknown>[]) {
      if (record.score_state !== 'SCORED') continue
      const score = record.score as Record<string, unknown>
      const zones = score.zone_durations as Record<string, number>
      await supabase.from('whoop_workouts').upsert({
        user_id: userId,
        workout_uuid: record.id,
        start_time: record.start,
        end_time: record.end,
        sport_id: record.sport_id ?? null,
        sport_name: record.sport_name,
        strain: score.strain,
        avg_heart_rate: score.average_heart_rate,
        max_heart_rate: score.max_heart_rate,
        kilojoule: score.kilojoule,
        percent_recorded: score.percent_recorded ?? null,
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
  } catch (e: unknown) {
    results.errors.push(`workouts: ${(e as Error).message}`)
  }

  // Record sync time
  await supabase.from('whoop_tokens')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)

  return results
}
