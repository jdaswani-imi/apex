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

  it('handles array-style ClassValue input', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('handles nested arrays of ClassValue', () => {
    expect(cn(['p-4', ['text-sm', 'font-bold']])).toBe('p-4 text-sm font-bold')
  })

  it('deduplicates conflicting tailwind classes passed via array', () => {
    expect(cn(['p-4', 'p-8'])).toBe('p-8')
  })

  it('handles array with falsy values', () => {
    expect(cn(['base', false, undefined, 'end'])).toBe('base end')
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

  it('returns yellow at upper boundary 66', () => {
    expect(getRecoveryColor(66)).toBe('text-yellow-400')
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

  it('returns yellow bg at upper boundary 66', () => {
    expect(getRecoveryBg(66)).toBe('bg-yellow-400')
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

  it('returns Yellow at upper boundary 66', () => {
    expect(getRecoveryLabel(66)).toBe('Yellow')
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

  it('returns 0 for same day (target equals from)', () => {
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

  it('is independent of the time of day (no off-by-one)', () => {
    // Both ends anchor to noon, so the result is the calendar gap regardless
    // of when in the day it is computed. TZ is pinned to Asia/Dubai in config.
    vi.setSystemTime(new Date('2025-05-21T08:00:00'))
    expect(getDaysToEvent(undefined, '2025-05-22')).toBe(1)
    vi.setSystemTime(new Date('2025-05-21T20:00:00'))
    expect(getDaysToEvent(undefined, '2025-05-22')).toBe(1)
  })

  it('uses current time when fromDate is an empty string', () => {
    vi.setSystemTime(new Date('2025-05-21T12:00:00'))
    const result = getDaysToEvent('', '2025-05-31')
    expect(result).toBe(10)
  })

  it('treats empty string fromDate same as undefined (falls back to now)', () => {
    vi.setSystemTime(new Date('2025-06-01T12:00:00'))
    const withUndefined = getDaysToEvent(undefined, '2025-06-11')
    const withEmpty = getDaysToEvent('', '2025-06-11')
    expect(withEmpty).toBe(withUndefined)
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

  it('returns the correct type for Tuesday (day 2)', () => {
    // 2024-01-02 is a Tuesday
    const date = new Date('2024-01-02T12:00:00')
    expect(date.getDay()).toBe(2)
    expect(getTrainingDayType(date, { '2': 'Pull' })).toBe('Pull')
  })

  it('returns the correct type for Wednesday (day 3)', () => {
    // 2024-01-03 is a Wednesday
    const date = new Date('2024-01-03T12:00:00')
    expect(date.getDay()).toBe(3)
    expect(getTrainingDayType(date, { '3': 'Legs' })).toBe('Legs')
  })

  it('returns the correct type for Thursday (day 4)', () => {
    // 2024-01-04 is a Thursday
    const date = new Date('2024-01-04T12:00:00')
    expect(date.getDay()).toBe(4)
    expect(getTrainingDayType(date, { '4': 'Push' })).toBe('Push')
  })

  it('returns the correct type for Friday (day 5)', () => {
    // 2024-01-05 is a Friday
    const date = new Date('2024-01-05T12:00:00')
    expect(date.getDay()).toBe(5)
    expect(getTrainingDayType(date, { '5': 'Pull' })).toBe('Pull')
  })

  it('returns Rest for Tuesday when Tuesday is not in split', () => {
    const date = new Date('2024-01-02T12:00:00') // Tuesday = 2
    expect(getTrainingDayType(date, { '1': 'Push', '3': 'Legs' })).toBe('Rest')
  })

  it('handles a full week split and returns correct value for each day', () => {
    const fullSplit: Record<string, string> = {
      '0': 'Rest',
      '1': 'Push',
      '2': 'Pull',
      '3': 'Legs',
      '4': 'Push',
      '5': 'Pull',
      '6': 'Cardio',
    }
    const monday = new Date('2024-01-01T12:00:00')   // day 1
    const tuesday = new Date('2024-01-02T12:00:00')  // day 2
    const wednesday = new Date('2024-01-03T12:00:00') // day 3
    const thursday = new Date('2024-01-04T12:00:00') // day 4
    const friday = new Date('2024-01-05T12:00:00')   // day 5
    const saturday = new Date('2024-01-06T12:00:00') // day 6
    const sunday = new Date('2024-01-07T12:00:00')   // day 0

    expect(getTrainingDayType(monday, fullSplit)).toBe('Push')
    expect(getTrainingDayType(tuesday, fullSplit)).toBe('Pull')
    expect(getTrainingDayType(wednesday, fullSplit)).toBe('Legs')
    expect(getTrainingDayType(thursday, fullSplit)).toBe('Push')
    expect(getTrainingDayType(friday, fullSplit)).toBe('Pull')
    expect(getTrainingDayType(saturday, fullSplit)).toBe('Cardio')
    expect(getTrainingDayType(sunday, fullSplit)).toBe('Rest')
  })
})
