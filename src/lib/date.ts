/**
 * Centralized date handling.
 *
 * The app is a daily-log tool for a user in the UAE (UTC+4). Using the UTC date
 * as "today" silently rolls the day over four hours early — anything logged
 * between local midnight and 04:00 lands on the previous calendar day, and AI
 * cache keys / date anchors drift with it. Every "today" / day-bucket
 * computation must go through these helpers so the timezone lives in one place.
 */

export const APP_TIMEZONE = 'Asia/Dubai'

const ISO_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function isoDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = ISO_DATE_FORMATTERS.get(timeZone)
  if (!fmt) {
    // en-CA renders as YYYY-MM-DD, the format the DB and cache keys expect.
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    ISO_DATE_FORMATTERS.set(timeZone, fmt)
  }
  return fmt
}

/** Today's calendar date (YYYY-MM-DD) in the app timezone. */
export function todayLocal(timeZone: string = APP_TIMEZONE): string {
  return isoDateFormatter(timeZone).format(new Date())
}

/** Convert any Date / ISO timestamp to its calendar date (YYYY-MM-DD) in the app timezone. */
export function localDateStr(date: Date | string | number, timeZone: string = APP_TIMEZONE): string {
  const d = date instanceof Date ? date : new Date(date)
  return isoDateFormatter(timeZone).format(d)
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Day of week (0 = Sunday … 6 = Saturday) in the app timezone. */
export function localDayOfWeek(date: Date = new Date(), timeZone: string = APP_TIMEZONE): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  return WEEKDAY_INDEX[weekday] ?? date.getDay()
}
