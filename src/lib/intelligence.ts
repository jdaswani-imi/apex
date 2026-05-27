import type { DailyLog, WhoopRecovery, WhoopSleep, SupplementLog, TrainingSession } from '@/lib/types'

export type DayFlag =
  | 'low_protein'
  | 'missed_supplements'
  | 'poor_sleep'
  | 'low_recovery'
  | 'skipped_training'
  | 'low_steps'
  | 'no_data'

export type DayQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Rough' | 'No Data'

export type WeekTrend = 'improving' | 'stable' | 'declining' | 'insufficient_data'

export interface ScoredDay {
  date: string
  score: number | null
  quality: DayQuality
  flags: DayFlag[]
}

export interface DayData {
  date: string
  log: DailyLog | null
  recovery: WhoopRecovery | null
  sleep: WhoopSleep | null
  supplements: SupplementLog[]
  sessions: TrainingSession[]
}

export interface Goals {
  daily_protein_target_g?: number | null
  daily_steps_target?: number | null
}

export type TrainingSplit = Record<string, string>

export interface WeekIntelligence {
  scoredDays: ScoredDay[]
  weightedAverage: number | null
  trend: WeekTrend
  yesterdayScore: number | null
  yesterdayQuality: DayQuality
  yesterdayFlags: DayFlag[]
}

export function scoreDay(
  data: DayData,
  goals: Goals,
  trainingSplit?: TrainingSplit | null,
): ScoredDay {
  const noSignal =
    !data.log && !data.recovery && !data.sleep &&
    data.supplements.length === 0 && data.sessions.length === 0

  if (noSignal) {
    return { date: data.date, score: null, quality: 'No Data', flags: ['no_data'] }
  }

  const proteinTarget = goals.daily_protein_target_g ?? 140
  const stepsTarget = goals.daily_steps_target ?? 10000

  let totalWeight = 0
  let earned = 0
  const flags: DayFlag[] = []

  // Recovery (max 25)
  if (data.recovery?.recovery_score != null) {
    const r = data.recovery.recovery_score
    totalWeight += 25
    if (r >= 67) earned += 25
    else if (r >= 34) earned += 17
    else { earned += 8; flags.push('low_recovery') }
  }

  // Sleep (max 20)
  if (data.sleep) {
    const hrs = data.sleep.duration_hrs ?? 0
    const perf = data.sleep.sleep_performance_pct ?? 0
    totalWeight += 20
    if (hrs >= 7.5 || perf >= 85) earned += 20
    else if (hrs >= 6.5 || perf >= 70) earned += 14
    else if (hrs >= 5.5) { earned += 7; flags.push('poor_sleep') }
    else { earned += 3; flags.push('poor_sleep') }
  }

  // Protein (max 20)
  const protein = data.log?.protein_g ?? null
  if (protein !== null) {
    const pct = protein / proteinTarget
    totalWeight += 20
    if (pct >= 1.0) earned += 20
    else if (pct >= 0.8) earned += 15
    else if (pct >= 0.6) { earned += 10; flags.push('low_protein') }
    else if (pct >= 0.4) { earned += 5; flags.push('low_protein') }
    else { flags.push('low_protein') }
  } else if (data.log) {
    flags.push('low_protein')
  }

  // Supplements (max 15) — only score if logs exist
  if (data.supplements.length > 0) {
    const taken = data.supplements.filter(s => s.taken).length
    const pct = taken / data.supplements.length
    totalWeight += 15
    if (pct >= 0.9) earned += 15
    else if (pct >= 0.7) earned += 11
    else if (pct >= 0.5) { earned += 7; flags.push('missed_supplements') }
    else { earned += 3; flags.push('missed_supplements') }
  }

  // Training (max 20)
  if (trainingSplit) {
    const dow = new Date(data.date + 'T12:00:00').getDay()
    const scheduled = trainingSplit[dow.toString()]
    const isRest = !scheduled || scheduled.toLowerCase() === 'rest'
    totalWeight += 20
    if (isRest) earned += 20
    else if (data.sessions.length > 0) earned += 20
    else flags.push('skipped_training')
  } else if (data.sessions.length > 0) {
    totalWeight += 20
    earned += 20
  }

  // Steps (max 5)
  const steps = data.log?.steps ?? null
  if (steps !== null) {
    const pct = steps / stepsTarget
    totalWeight += 5
    if (pct >= 1.0) earned += 5
    else if (pct >= 0.8) earned += 4
    else if (pct >= 0.5) { earned += 2; flags.push('low_steps') }
    else { earned += 0; flags.push('low_steps') }
  }

  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : null

  const quality: DayQuality =
    score === null ? 'No Data' :
    score >= 85 ? 'Excellent' :
    score >= 70 ? 'Good' :
    score >= 50 ? 'Fair' :
    score >= 30 ? 'Poor' : 'Rough'

  return { date: data.date, score, quality, flags }
}

// Exponential decay weighted average — most recent day weighted highest
export function computeWeightedAverage(scoredDays: ScoredDay[], decay = 0.80): number | null {
  const valid = scoredDays.filter(d => d.score !== null)
  if (valid.length === 0) return null

  let weightSum = 0
  let valueSum = 0
  for (let i = 0; i < valid.length; i++) {
    const w = Math.pow(decay, i)
    valueSum += valid[i].score! * w
    weightSum += w
  }

  return Math.round(valueSum / weightSum)
}

// Compare recent 3 days vs earlier 4 days
export function detectTrend(scoredDays: ScoredDay[]): WeekTrend {
  const valid = scoredDays.filter(d => d.score !== null)
  if (valid.length < 4) return 'insufficient_data'

  const recent = valid.slice(0, 3)
  const earlier = valid.slice(3)
  const recentAvg = recent.reduce((s, d) => s + d.score!, 0) / recent.length
  const earlierAvg = earlier.reduce((s, d) => s + d.score!, 0) / earlier.length

  const diff = recentAvg - earlierAvg
  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}

export function buildWeekIntelligence(
  dayDataList: DayData[],
  goals: Goals,
  trainingSplit?: TrainingSplit | null,
): WeekIntelligence {
  const scoredDays = dayDataList.map(d => scoreDay(d, goals, trainingSplit))
  const weightedAverage = computeWeightedAverage(scoredDays)
  const trend = detectTrend(scoredDays)
  const yesterday = scoredDays[0]

  return {
    scoredDays,
    weightedAverage,
    trend,
    yesterdayScore: yesterday?.score ?? null,
    yesterdayQuality: yesterday?.quality ?? 'No Data',
    yesterdayFlags: yesterday?.flags ?? [],
  }
}

export const FLAG_LABELS: Record<DayFlag, string> = {
  low_protein: 'Low protein',
  missed_supplements: 'Missed supps',
  poor_sleep: 'Short sleep',
  low_recovery: 'Low recovery',
  skipped_training: 'Skipped session',
  low_steps: 'Low steps',
  no_data: 'No data',
}
