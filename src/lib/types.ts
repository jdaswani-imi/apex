export type RecoveryZone = 'green' | 'yellow' | 'red' | null

export interface DailyLog {
  id: string
  user_id: string
  date: string
  weight_kg: number | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fats_g: number | null
  steps: number | null
  notes: string | null
  day_rating_training: number | null
  day_rating_nutrition: number | null
  day_rating_sleep: number | null
  day_rating_supplements: number | null
  feeling_recovery: number | null
  feeling_sleep_quality: number | null
  feeling_sleep_hours: number | null
  feeling_strain: number | null
  created_at: string
}

export interface TrainingSession {
  id: string
  user_id: string
  date: string
  session_type: string
  gym: string | null
  duration_min: number | null
  volume_kg: number | null
  prs: number | null
  whoop_strain: number | null
  notes: string | null
  created_at: string
  exercises?: Exercise[]
}

export interface Exercise {
  id: string
  session_id: string
  name: string
  sets: number | null
  reps: number | null
  weight_kg: number | null
  notes: string | null
}

export interface SupplementLog {
  id: string
  user_id: string
  date: string
  supplement_name: string
  taken: boolean
  time_taken: string | null
  notes: string | null
  created_at: string
}

export interface WhoopRecovery {
  id: string
  user_id: string
  date: string
  cycle_id: number | null
  recovery_score: number | null
  hrv_rmssd_milli: number | null
  resting_heart_rate: number | null
  spo2_percentage: number | null
  skin_temp_celsius: number | null
  synced_at: string
}

export interface WhoopSleep {
  id: string
  user_id: string
  date: string
  sleep_uuid: string | null
  start_time: string | null
  end_time: string | null
  duration_hrs: number | null
  deep_sleep_min: number | null
  rem_min: number | null
  light_sleep_min: number | null
  awake_min: number | null
  sleep_performance_pct: number | null
  sleep_efficiency_pct: number | null
  respiratory_rate: number | null
  nap: boolean
  synced_at: string
}

export interface WhoopCycle {
  id: string
  user_id: string
  date: string
  cycle_id: number | null
  strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  kilojoule: number | null
  synced_at: string
}

export interface WhoopWorkout {
  id: string
  user_id: string
  workout_uuid: string
  start_time: string | null
  end_time: string | null
  sport_name: string | null
  strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  kilojoule: number | null
  zone_0_min: number | null
  zone_1_min: number | null
  zone_2_min: number | null
  zone_3_min: number | null
  zone_4_min: number | null
  zone_5_min: number | null
  synced_at: string
}

export interface FoodLog {
  id: string
  user_id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fats_g: number | null
  notes: string | null
  created_at: string
}

export interface MenstrualCycle {
  id: string
  user_id: string
  period_start_date: string
  period_end_date: string | null
  cycle_length_days: number
  notes: string | null
  created_at: string
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

export interface CyclePhaseInfo {
  phase: CyclePhase
  cycleDay: number
  cycleLength: number
  lastPeriodStart: string
  daysUntilNextPeriod: number
}

export function getCyclePhase(lastPeriodStart: string, cycleLength = 28): CyclePhaseInfo {
  const start = new Date(lastPeriodStart + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const cycleDay = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const normalizedDay = ((cycleDay - 1) % cycleLength) + 1
  const daysUntilNextPeriod = cycleLength - normalizedDay + 1

  let phase: CyclePhase
  if (normalizedDay <= 5) {
    phase = 'menstrual'
  } else if (normalizedDay <= Math.floor(cycleLength / 2) - 1) {
    phase = 'follicular'
  } else if (normalizedDay <= Math.floor(cycleLength / 2) + 1) {
    phase = 'ovulatory'
  } else {
    phase = 'luteal'
  }

  return { phase, cycleDay: normalizedDay, cycleLength, lastPeriodStart, daysUntilNextPeriod }
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface TodayContext {
  date: string
  dailyLog: DailyLog | null
  recovery: WhoopRecovery | null
  sleep: WhoopSleep | null
  cycle: WhoopCycle | null
  supplements: SupplementLog[]
  trainingSessions: TrainingSession[]
  recentLogs: DailyLog[]
  recentRecovery: WhoopRecovery[]
  recentSleep: WhoopSleep[]
}
