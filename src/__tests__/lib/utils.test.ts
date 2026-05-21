import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  cn,
  getRecoveryColor,
  getRecoveryBg,
  getRecoveryLabel,
  getDaysToEvent,
  getTrainingDayType,
} from '@/lib/utils'

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting tailwind classes', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('handles conditional classes via clsx', () => {
    expect(cn('base', false && 'skip', 'end')).toBe('base end')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })

  it('handles undefined and null values', () => {
    expect(cn(undefined, null, 'real')).toBe('real')
  })
})

describe('getRecoveryColor', () => {
  it('returns green at boundary 67', () => {
    expect(getRecoveryColor(67)).toBe('text-green-400')
  })

  it('returns green above 67', () => {
    expect(getRecoveryColor(100)).toBe('text-green-400')
  })

  it('returns yellow at boundary 34', () => {
    expect(getRecoveryColor(34)).toBe('text-yellow-400')
  })

  it('returns yellow between 34 and 66', () => {
    expect(getRecoveryColor(50)).toBe('text-yellow-400')
  })

  it('returns red below 34', () => {
    expect(getRecoveryColor(33)).toBe('text-red-400')
  })

  it('returns red at 0', () => {
    expect(getRecoveryColor(0)).toBe('text-red-400')
  })
})

describe('getRecoveryBg', () => {
  it('returns green bg at 67', () => {
    expect(getRecoveryBg(67)).toBe('bg-green-400')
  })

  it('returns green bg above 67', () => {
    expect(getRecoveryBg(90)).toBe('bg-green-400')
  })

  it('returns yellow bg at 34', () => {
    expect(getRecoveryBg(34)).toBe('bg-yellow-400')
  })

  it('returns yellow bg between 34 and 66', () => {
    expect(getRecoveryBg(60)).toBe('bg-yellow-400')
  })

  it('returns red bg below 34', () => {
    expect(getRecoveryBg(33)).toBe('bg-red-400')
  })

  it('returns red bg at 0', () => {
    expect(getRecoveryBg(0)).toBe('bg-red-400')
  })
})

describe('getRecoveryLabel', () => {
  it('returns Green at 67', () => {
    expect(getRecoveryLabel(67)).toBe('Green')
  })

  it('returns Green above 67', () => {
    expect(getRecoveryLabel(80)).toBe('Green')
  })

  it('returns Yellow at 34', () => {
    expect(getRecoveryLabel(34)).toBe('Yellow')
  })

  it('returns Yellow between 34 and 66', () => {
    expect(getRecoveryLabel(50)).toBe('Yellow')
  })

  it('returns Red below 34', () => {
    expect(getRecoveryLabel(33)).toBe('Red')
  })

  it('returns Red at 0', () => {
    expect(getRecoveryLabel(0)).toBe('Red')
  })
})

describe('getDaysToEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns correct positive days with explicit fromDate', () => {
    expect(getDaysToEvent('2025-01-01', '2025-01-11')).toBe(10)
  })

  it('returns 1 for same day (target equals from)', () => {
    // target - from = 0 ms, Math.ceil(0) = 0
    expect(getDaysToEvent('2025-06-01', '2025-06-01')).toBe(0)
  })

  it('returns negative days when target is in the past', () => {
    expect(getDaysToEvent('2025-01-11', '2025-01-01')).toBe(-10)
  })

  it('returns 1 for next day', () => {
    expect(getDaysToEvent('2025-05-20', '2025-05-21')).toBe(1)
  })

  it('uses current time when fromDate is undefined', () => {
    vi.setSystemTime(new Date('2025-05-21T12:00:00'))
    const result = getDaysToEvent(undefined, '2025-05-31')
    expect(result).toBe(10)
  })

  it('returns fractional ceil when system time is not noon', () => {
    // from = now (not noon), target = T12:00:00, so diff < 24hrs → Math.ceil = 1
    vi.setSystemTime(new Date('2025-05-21T20:00:00'))
    const result = getDaysToEvent(undefined, '2025-05-22')
    expect(result).toBe(1)
  })
})

describe('getTrainingDayType', () => {
  it('returns the split value for the matching day of week', () => {
    // 2024-01-01 is a Monday (day 1)
    const date = new Date('2024-01-01T12:00:00')
    expect(date.getDay()).toBe(1)
    expect(getTrainingDayType(date, { '1': 'Push' })).toBe('Push')
  })

  it('returns Rest when day has no entry in split', () => {
    const date = new Date('2024-01-01T12:00:00') // Monday = 1
    expect(getTrainingDayType(date, { '0': 'Pull' })).toBe('Rest')
  })

  it('returns Rest for an empty split', () => {
    const date = new Date('2024-01-07T12:00:00') // Sunday = 0
    expect(getTrainingDayType(date, {})).toBe('Rest')
  })

  it('returns the correct type for Sunday (day 0)', () => {
    const date = new Date('2024-01-07T12:00:00') // Sunday
    expect(date.getDay()).toBe(0)
    expect(getTrainingDayType(date, { '0': 'Legs' })).toBe('Legs')
  })

  it('returns the correct type for Saturday (day 6)', () => {
    const date = new Date('2024-01-06T12:00:00') // Saturday
    expect(date.getDay()).toBe(6)
    expect(getTrainingDayType(date, { '6': 'Cardio' })).toBe('Cardio')
  })
})
