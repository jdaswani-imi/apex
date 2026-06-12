import { describe, it, expect } from 'vitest'
import {
  scoreDay,
  computeWeightedAverage,
  detectTrend,
  buildWeekIntelligence,
  FLAG_LABELS,
  type DayData,
  type Goals,
  type ScoredDay,
  type TrainingSplit,
} from '@/lib/intelligence'
import type { DailyLog, WhoopRecovery, WhoopSleep, SupplementLog, TrainingSession } from '@/lib/types'

// ─── Minimal stub builders ───────────────────────────────────────────────────

function makeLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: 'log-1', user_id: 'u1', date: '2025-01-01',
    weight_kg: null, calories: null, protein_g: null, carbs_g: null,
    fats_g: null, steps: null, notes: null,
    day_rating_training: null, day_rating_nutrition: null,
    day_rating_sleep: null, day_rating_supplements: null,
    feeling_recovery: null, feeling_sleep_quality: null,
    feeling_sleep_hours: null, feeling_strain: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeRecovery(score: number | null): WhoopRecovery {
  return {
    id: 'r1', user_id: 'u1', date: '2025-01-01', cycle_id: null,
    recovery_score: score, hrv_rmssd_milli: null,
    resting_heart_rate: null, spo2_percentage: null,
    skin_temp_celsius: null, synced_at: '2025-01-01T00:00:00Z',
  }
}

function makeSleep(hrs: number | null, perf: number | null): WhoopSleep {
  return {
    id: 's1', user_id: 'u1', date: '2025-01-01', sleep_uuid: null,
    start_time: null, end_time: null, duration_hrs: hrs,
    deep_sleep_min: null, rem_min: null, light_sleep_min: null,
    awake_min: null, sleep_performance_pct: perf,
    sleep_efficiency_pct: null, respiratory_rate: null,
    nap: false, synced_at: '2025-01-01T00:00:00Z',
  }
}

function makeSupp(taken: boolean): SupplementLog {
  return {
    id: 'supp-1', user_id: 'u1', date: '2025-01-01',
    supplement_name: 'Creatine', taken,
    time_taken: null, notes: null, created_at: '2025-01-01T00:00:00Z',
  }
}

function makeSession(): TrainingSession {
  return {
    id: 'sess-1', user_id: 'u1', date: '2025-01-01',
    session_type: 'Strength', gym: null, duration_min: 60,
    volume_kg: null, prs: null, whoop_strain: null,
    notes: null, created_at: '2025-01-01T00:00:00Z',
    template_id: null, finished_at: null, started_at: null,
  }
}

function emptyDay(date = '2025-01-01'): DayData {
  return { date, log: null, recovery: null, sleep: null, supplements: [], sessions: [] }
}

function scoredDay(score: number | null, date = '2025-01-01'): ScoredDay {
  const quality = score === null ? 'No Data' :
    score >= 85 ? 'Excellent' : score >= 70 ? 'Good' :
    score >= 50 ? 'Fair' : score >= 30 ? 'Poor' : 'Rough'
  return { date, score, quality, flags: [] }
}

const baseGoals: Goals = { daily_protein_target_g: 140, daily_steps_target: 10000 }

// ─── scoreDay ────────────────────────────────────────────────────────────────

describe('scoreDay', () => {
  describe('no data', () => {
    it('returns null score and no_data flag when all signals absent', () => {
      const result = scoreDay(emptyDay(), baseGoals)
      expect(result.score).toBeNull()
      expect(result.quality).toBe('No Data')
      expect(result.flags).toEqual(['no_data'])
    })
  })

  // ── Recovery scoring ──────────────────────────────────────────────────────

  describe('recovery scoring', () => {
    it('awards 25pts for score ≥67', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(67) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(100)
      expect(result.flags).not.toContain('low_recovery')
    })

    it('awards 25pts for score above 67', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(90) }
      expect(scoreDay(day, baseGoals).score).toBe(100)
    })

    it('awards 17pts for score ≥34 and <67', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(34) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((17 / 25) * 100))
      expect(result.flags).not.toContain('low_recovery')
    })

    it('awards 8pts and low_recovery flag for score <34', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(10) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((8 / 25) * 100))
      expect(result.flags).toContain('low_recovery')
    })

    it('skips recovery scoring when recovery_score is null', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(null) }
      // recovery object present but score null → treated like noSignal unless other data
      // no other signals → noSignal path
      expect(scoreDay(day, baseGoals).score).toBeNull()
    })
  })

  // ── Sleep scoring ─────────────────────────────────────────────────────────

  describe('sleep scoring', () => {
    it('awards 20pts for hrs ≥7.5', () => {
      const day: DayData = { ...emptyDay(), sleep: makeSleep(7.5, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(100)
      expect(result.flags).not.toContain('poor_sleep')
    })

    it('awards 20pts for perf ≥85 even if hrs <7.5', () => {
      const day: DayData = { ...emptyDay(), sleep: makeSleep(5.0, 85) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(100)
      expect(result.flags).not.toContain('poor_sleep')
    })

    it('awards 14pts for hrs ≥6.5 and <7.5', () => {
      const day: DayData = { ...emptyDay(), sleep: makeSleep(6.5, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((14 / 20) * 100))
      expect(result.flags).not.toContain('poor_sleep')
    })

    it('awards 14pts for perf ≥70 even if hrs <6.5', () => {
      const day: DayData = { ...emptyDay(), sleep: makeSleep(4.0, 70) }
      expect(scoreDay(day, baseGoals).score).toBe(Math.round((14 / 20) * 100))
    })

    it('awards 7pts and poor_sleep for hrs ≥5.5 and <6.5 and perf <70', () => {
      const day: DayData = { ...emptyDay(), sleep: makeSleep(5.5, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((7 / 20) * 100))
      expect(result.flags).toContain('poor_sleep')
    })

    it('awards 3pts and poor_sleep for hrs <5.5 and perf <70', () => {
      const day: DayData = { ...emptyDay(), sleep: makeSleep(4.0, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((3 / 20) * 100))
      expect(result.flags).toContain('poor_sleep')
    })

    it('uses 0 defaults when duration_hrs and sleep_performance_pct are null', () => {
      const day: DayData = { ...emptyDay(), sleep: makeSleep(null, null) }
      // 0 hrs, 0 perf → <5.5 branch → 3pts
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((3 / 20) * 100))
      expect(result.flags).toContain('poor_sleep')
    })
  })

  // ── Protein scoring ───────────────────────────────────────────────────────

  describe('protein scoring', () => {
    it('awards 20pts for protein ≥100% of target', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: 140 }) }
      expect(scoreDay(day, baseGoals).score).toBe(100)
    })

    it('awards 20pts for protein above target', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: 200 }) }
      expect(scoreDay(day, baseGoals).score).toBe(100)
    })

    it('awards 15pts for protein ≥80% and <100%', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: 112 }) } // 80% of 140
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((15 / 20) * 100))
      expect(result.flags).not.toContain('low_protein')
    })

    it('awards 10pts and low_protein for ≥60% and <80%', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: 84 }) } // 60% of 140
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((10 / 20) * 100))
      expect(result.flags).toContain('low_protein')
    })

    it('awards 5pts and low_protein for ≥40% and <60%', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: 56 }) } // 40% of 140
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((5 / 20) * 100))
      expect(result.flags).toContain('low_protein')
    })

    it('awards 0pts and low_protein for <40%', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: 10 }) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(0)
      expect(result.flags).toContain('low_protein')
    })

    it('flags low_protein when log exists but protein_g is null', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: null }) }
      const result = scoreDay(day, baseGoals)
      expect(result.flags).toContain('low_protein')
      // no weight added for protein, totalWeight=0 → score null
      expect(result.score).toBeNull()
    })

    it('uses default protein target of 140 when goal not set', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ protein_g: 140 }) }
      expect(scoreDay(day, {}).score).toBe(100)
    })
  })

  // ── Supplement scoring ────────────────────────────────────────────────────

  describe('supplement scoring', () => {
    it('awards 15pts for ≥90% taken', () => {
      // 10 taken, 1 missed = 90.9%
      const supps = Array.from({ length: 10 }, () => makeSupp(true))
      supps.push(makeSupp(false))
      const day: DayData = { ...emptyDay(), supplements: supps }
      expect(scoreDay(day, baseGoals).score).toBe(100)
    })

    it('awards 11pts for ≥70% and <90% taken', () => {
      // 7 taken, 3 missed = 70%
      const supps = [
        ...Array.from({ length: 7 }, () => makeSupp(true)),
        ...Array.from({ length: 3 }, () => makeSupp(false)),
      ]
      const day: DayData = { ...emptyDay(), supplements: supps }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((11 / 15) * 100))
      expect(result.flags).not.toContain('missed_supplements')
    })

    it('awards 7pts and missed_supplements for ≥50% and <70%', () => {
      // 5 taken, 5 missed = 50%
      const supps = [
        ...Array.from({ length: 5 }, () => makeSupp(true)),
        ...Array.from({ length: 5 }, () => makeSupp(false)),
      ]
      const day: DayData = { ...emptyDay(), supplements: supps }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((7 / 15) * 100))
      expect(result.flags).toContain('missed_supplements')
    })

    it('awards 3pts and missed_supplements for <50% taken', () => {
      // 1 taken, 3 missed = 25%
      const supps = [makeSupp(true), makeSupp(false), makeSupp(false), makeSupp(false)]
      const day: DayData = { ...emptyDay(), supplements: supps }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((3 / 15) * 100))
      expect(result.flags).toContain('missed_supplements')
    })

    it('skips supplement scoring when no supplement logs exist', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(100) }
      // no supplements → totalWeight=25, earned=25
      expect(scoreDay(day, baseGoals).score).toBe(100)
    })
  })

  // ── Training scoring (with split) ─────────────────────────────────────────

  describe('training scoring with trainingSplit', () => {
    // 2025-01-06 = Monday = day 1
    const MONDAY = '2025-01-06'

    it('awards 10pts on a rest day regardless of sessions', () => {
      const day: DayData = { ...emptyDay(MONDAY), recovery: makeRecovery(67) }
      const split: TrainingSplit = { '1': 'rest' }
      const result = scoreDay(day, baseGoals, split)
      expect(result.flags).not.toContain('skipped_training')
    })

    it('awards 10pts when day is not in split (undefined = rest)', () => {
      const day: DayData = { ...emptyDay(MONDAY), recovery: makeRecovery(67) }
      const split: TrainingSplit = { '2': 'Push' } // Monday not listed
      const result = scoreDay(day, baseGoals, split)
      expect(result.flags).not.toContain('skipped_training')
    })

    it('awards 10pts when scheduled day has sessions', () => {
      const day: DayData = { ...emptyDay(MONDAY), recovery: makeRecovery(67), sessions: [makeSession()] }
      const split: TrainingSplit = { '1': 'Push' }
      const result = scoreDay(day, baseGoals, split)
      expect(result.flags).not.toContain('skipped_training')
    })

    it('flags skipped_training when scheduled but no sessions', () => {
      const day: DayData = { ...emptyDay(MONDAY), recovery: makeRecovery(67) }
      const split: TrainingSplit = { '1': 'Push' }
      const result = scoreDay(day, baseGoals, split)
      expect(result.flags).toContain('skipped_training')
    })
  })

  // ── Training scoring (no split) ───────────────────────────────────────────

  describe('training scoring without trainingSplit', () => {
    it('awards 10pts when sessions exist and no split provided', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(67), sessions: [makeSession()] }
      const result = scoreDay(day, baseGoals)
      expect(result.flags).not.toContain('skipped_training')
      // recovery 25/25 + training 10/10 → total weight=35, earned=35
      expect(result.score).toBe(100)
    })

    it('adds no training weight when no split and no sessions', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(67) }
      const result = scoreDay(day, baseGoals, null)
      // totalWeight=25, earned=25
      expect(result.score).toBe(100)
    })
  })

  // ── Steps scoring ─────────────────────────────────────────────────────────

  describe('steps scoring', () => {
    it('awards 10pts for steps ≥100% of target', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ steps: 10000 }) }
      expect(scoreDay(day, baseGoals).score).toBe(100)
    })

    it('awards 4pts for ≥80% and <100% of target', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ steps: 8000 }) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((4 / 5) * 100))
      expect(result.flags).not.toContain('low_steps')
    })

    it('awards 4pts and low_steps for ≥50% and <80%', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ steps: 5000 }) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((4 / 10) * 100))
      expect(result.flags).toContain('low_steps')
    })

    it('awards 0pts and low_steps for <50% of target', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ steps: 1000 }) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((0 / 5) * 100))
      expect(result.flags).toContain('low_steps')
    })

    it('skips step scoring when steps is null', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ steps: null }) }
      // log exists, protein null → low_protein flag, totalWeight=0 → null score
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBeNull()
    })

    it('uses default steps target of 10000 when goal not set', () => {
      const day: DayData = { ...emptyDay(), log: makeLog({ steps: 10000 }) }
      expect(scoreDay(day, {}).score).toBe(100)
    })
  })

  // ── Quality thresholds ────────────────────────────────────────────────────

  describe('quality thresholds', () => {
    function dayWithScore(score: number): DayData {
      // Use only recovery (weight=25) to get a clean percentage
      // earned = score/100 * 25; recovery_score ≥67 → 25, ≥34 → 17, else 8
      // To hit arbitrary scores, combine recovery + sleep
      // Easier: use steps only (weight=10) with protein (weight=20)
      // We'll directly craft via recovery + sleep for common thresholds
      // For exact control: use recovery(67)=25pts/25 → 100
      // Just test representative scores via multiple signals
      return { ...emptyDay(), recovery: makeRecovery(67) }
    }

    it('returns Excellent for score ≥85', () => {
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(67) }
      expect(scoreDay(day, baseGoals).quality).toBe('Excellent')
    })

    it('returns Good for score ≥70 and <85', () => {
      // recovery=34→17pts, sleep=6.5hrs→14pts; total=31/45 ≈ 69% → need to verify
      // recovery=34→17/25, sleep=7.5→20/20; earned=37, weight=45, score=82 → Good
      // Let's use: recovery=34(17pts), sleep=6.5(14pts): 31/45=69 → Fair, not Good
      // recovery=67(25pts), sleep=6.5(14pts): 39/45=87 → Excellent
      // To get Good (70-84): recovery=34(17pts), sleep=7.5(20pts): 37/45=82 → Good
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(34), sleep: makeSleep(7.5, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((37 / 45) * 100))
      expect(result.quality).toBe('Good')
    })

    it('returns Fair for score ≥50 and <70', () => {
      // recovery=34(17pts)/25 + sleep=5.5(7pts)/20 = 24/45 = 53 → Fair
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(34), sleep: makeSleep(5.5, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((24 / 45) * 100))
      expect(result.quality).toBe('Fair')
    })

    it('returns Poor for score ≥30 and <50', () => {
      // recovery=10(8pts)/25 + sleep=5.5(7pts)/20 = 15/45 = 33 → Poor
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(10), sleep: makeSleep(5.5, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((15 / 45) * 100))
      expect(result.quality).toBe('Poor')
    })

    it('returns Rough for score <30', () => {
      // recovery=10(8pts)/25 + sleep=4(3pts)/20 = 11/45 = 24 → Rough
      const day: DayData = { ...emptyDay(), recovery: makeRecovery(10), sleep: makeSleep(4.0, 0) }
      const result = scoreDay(day, baseGoals)
      expect(result.score).toBe(Math.round((11 / 45) * 100))
      expect(result.quality).toBe('Rough')
    })
  })
})

// ─── computeWeightedAverage ───────────────────────────────────────────────────

describe('computeWeightedAverage', () => {
  it('returns null for empty array', () => {
    expect(computeWeightedAverage([])).toBeNull()
  })

  it('returns null when all days have null scores', () => {
    const days: ScoredDay[] = [
      { date: '2025-01-01', score: null, quality: 'No Data', flags: ['no_data'] },
    ]
    expect(computeWeightedAverage(days)).toBeNull()
  })

  it('returns the single score for a single scored day', () => {
    const days: ScoredDay[] = [scoredDay(80)]
    expect(computeWeightedAverage(days)).toBe(80)
  })

  it('weights most recent day (index 0) highest with default decay 0.80', () => {
    // day0=100, day1=0 → valueSum=100*1 + 0*0.8=100, weightSum=1+0.8=1.8 → 100/1.8=55.5→56
    const days: ScoredDay[] = [scoredDay(100, '2025-01-02'), scoredDay(0, '2025-01-01')]
    expect(computeWeightedAverage(days)).toBe(Math.round(100 / 1.8))
  })

  it('accepts custom decay factor', () => {
    // decay=0.5: day0=100, day1=0 → 100*1 + 0*0.5 / (1+0.5) = 100/1.5 = 66.67→67
    const days: ScoredDay[] = [scoredDay(100), scoredDay(0)]
    expect(computeWeightedAverage(days, 0.5)).toBe(Math.round(100 / 1.5))
  })

  it('skips null-score days in the weighted average', () => {
    const days: ScoredDay[] = [
      scoredDay(80),
      { date: '2025-01-02', score: null, quality: 'No Data', flags: ['no_data'] },
      scoredDay(60),
    ]
    // valid=[80,60], valueSum=80*1+60*0.8=80+48=128, weightSum=1+0.8=1.8 → round(128/1.8)=71
    expect(computeWeightedAverage(days)).toBe(Math.round(128 / 1.8))
  })

  it('correctly handles three scored days', () => {
    // day0=90, day1=80, day2=70; decay=0.8
    // valueSum = 90*1 + 80*0.8 + 70*0.64 = 90+64+44.8=198.8
    // weightSum = 1+0.8+0.64=2.44
    // result = round(198.8/2.44) = round(81.47) = 81
    const days = [scoredDay(90), scoredDay(80), scoredDay(70)]
    expect(computeWeightedAverage(days)).toBe(Math.round(198.8 / 2.44))
  })
})

// ─── detectTrend ─────────────────────────────────────────────────────────────

describe('detectTrend', () => {
  it('returns insufficient_data for empty array', () => {
    expect(detectTrend([])).toBe('insufficient_data')
  })

  it('returns insufficient_data for fewer than 4 scored days', () => {
    const days = [scoredDay(80), scoredDay(70), scoredDay(60)]
    expect(detectTrend(days)).toBe('insufficient_data')
  })

  it('returns insufficient_data when nulls reduce valid count below 4', () => {
    const days = [
      scoredDay(80),
      { date: '2025-01-02', score: null, quality: 'No Data' as const, flags: [] },
      scoredDay(70),
      scoredDay(60),
    ]
    expect(detectTrend(days)).toBe('insufficient_data')
  })

  it('returns improving when recent 3 avg exceeds earlier avg by >5', () => {
    // recent=[90,90,90] avg=90; earlier=[80] avg=80; diff=10>5
    const days = [scoredDay(90), scoredDay(90), scoredDay(90), scoredDay(80)]
    expect(detectTrend(days)).toBe('improving')
  })

  it('returns declining when recent 3 avg is more than 5 below earlier avg', () => {
    // recent=[70,70,70] avg=70; earlier=[80] avg=80; diff=-10<-5
    const days = [scoredDay(70), scoredDay(70), scoredDay(70), scoredDay(80)]
    expect(detectTrend(days)).toBe('declining')
  })

  it('returns stable when diff is within ±5', () => {
    // recent=[80,80,80] avg=80; earlier=[82] avg=82; diff=-2
    const days = [scoredDay(80), scoredDay(80), scoredDay(80), scoredDay(82)]
    expect(detectTrend(days)).toBe('stable')
  })

  it('returns stable when diff is exactly 5', () => {
    // diff=5 is not >5 → stable
    const days = [scoredDay(85), scoredDay(85), scoredDay(85), scoredDay(80)]
    // recent avg = 85, earlier avg = 80, diff = 5 → stable (not > 5)
    expect(detectTrend(days)).toBe('stable')
  })

  it('returns stable when diff is exactly -5', () => {
    const days = [scoredDay(80), scoredDay(80), scoredDay(80), scoredDay(85)]
    // diff = -5 → stable (not < -5)
    expect(detectTrend(days)).toBe('stable')
  })

  it('uses more than 4 valid days correctly', () => {
    // recent=[90,90,90] avg=90; earlier=[70,70] avg=70; diff=20→improving
    const days = [scoredDay(90), scoredDay(90), scoredDay(90), scoredDay(70), scoredDay(70)]
    expect(detectTrend(days)).toBe('improving')
  })
})

// ─── buildWeekIntelligence ────────────────────────────────────────────────────

describe('buildWeekIntelligence', () => {
  it('returns correct structure for empty dayDataList', () => {
    const result = buildWeekIntelligence([], baseGoals)
    expect(result.scoredDays).toEqual([])
    expect(result.weightedAverage).toBeNull()
    expect(result.trend).toBe('insufficient_data')
    expect(result.yesterdayScore).toBeNull()
    expect(result.yesterdayQuality).toBe('No Data')
    expect(result.yesterdayFlags).toEqual([])
  })

  it('uses first element as yesterday', () => {
    const dayDataList: DayData[] = [
      { ...emptyDay('2025-01-07'), recovery: makeRecovery(80) },
      { ...emptyDay('2025-01-06') },
    ]
    const result = buildWeekIntelligence(dayDataList, baseGoals)
    expect(result.yesterdayScore).toBe(100)
    expect(result.yesterdayQuality).toBe('Excellent')
  })

  it('passes trainingSplit through to scoreDay', () => {
    // Monday 2025-01-06, split says Push → no sessions → skipped_training
    const dayDataList: DayData[] = [
      { ...emptyDay('2025-01-06'), recovery: makeRecovery(67) },
    ]
    const split: TrainingSplit = { '1': 'Push' }
    const result = buildWeekIntelligence(dayDataList, baseGoals, split)
    expect(result.yesterdayFlags).toContain('skipped_training')
  })

  it('correctly computes trend across sufficient days', () => {
    const dayDataList: DayData[] = [
      { ...emptyDay('2025-01-07'), recovery: makeRecovery(67) },
      { ...emptyDay('2025-01-06'), recovery: makeRecovery(67) },
      { ...emptyDay('2025-01-05'), recovery: makeRecovery(67) },
      { ...emptyDay('2025-01-04'), recovery: makeRecovery(10) },
    ]
    // recent=[100,100,100] avg=100; earlier=[32] avg=32; diff=68→improving
    const result = buildWeekIntelligence(dayDataList, baseGoals)
    expect(result.trend).toBe('improving')
  })
})

// ─── FLAG_LABELS ──────────────────────────────────────────────────────────────

describe('FLAG_LABELS', () => {
  const expectedKeys = [
    'low_protein',
    'missed_supplements',
    'poor_sleep',
    'low_recovery',
    'skipped_training',
    'low_steps',
    'no_data',
  ] as const

  it('contains all 7 expected flag keys', () => {
    expect(Object.keys(FLAG_LABELS)).toHaveLength(7)
    for (const key of expectedKeys) {
      expect(FLAG_LABELS).toHaveProperty(key)
    }
  })

  it('all values are non-empty strings', () => {
    for (const key of expectedKeys) {
      expect(typeof FLAG_LABELS[key]).toBe('string')
      expect(FLAG_LABELS[key].length).toBeGreaterThan(0)
    }
  })
})
