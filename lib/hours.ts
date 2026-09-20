/**
 * Opening hours.
 *
 * A day is one of:
 *   'closed'                                  yopiq
 *   ["09:00", "22:00"]                        one range
 *   [["09:00","15:00"], ["18:00","23:00"]]    a break in the middle
 *
 * The third form is not an edge case here — a great many restaurants and
 * clinics close between lunch and dinner, and a schema that cannot say so
 * forces whoever enters the data to lie.
 *
 * Closing at or after midnight is written as "24:00" on the day it starts.
 * That keeps every range comparable as plain minutes-since-midnight, with
 * no wrap-around special case anywhere downstream.
 */
export type Range = [string, string]
export type DayHours = 'closed' | Range | Range[]

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export type Hours = Partial<Record<Weekday, DayHours>>

/** Minutes since midnight. "24:00" is 1440, which sorts after everything. */
export function toMinutes(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
}

/** Collapses every accepted shape into a plain list of ranges. */
export function normalizeDay(day: DayHours | undefined): Range[] {
  if (!day || day === 'closed') return []
  // A single range is a 2-tuple of strings; multiple ranges is an array
  // of those. Checking the first element tells them apart.
  return typeof day[0] === 'string' ? [day as Range] : (day as Range[])
}

/** Uzbek weekday index: Monday is 0, matching WEEKDAYS. */
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7]
}

/**
 * Tashkent is UTC+5 year-round with no daylight saving. Reading the
 * visitor's own clock would tell a traveller the wrong answer.
 */
export function tashkentNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + 5 * 3_600_000)
}

/** null when the business publishes no hours at all. */
export function isOpenAt(hours: Hours | undefined, at: Date): boolean | null {
  if (!hours || !Object.keys(hours).length) return null
  const ranges = normalizeDay(hours[weekdayOf(at)])
  if (!ranges.length) return false
  const mins = at.getHours() * 60 + at.getMinutes()
  return ranges.some(([open, close]) => mins >= toMinutes(open) && mins < toMinutes(close))
}

/** "09:00–15:00, 18:00–23:00" — or "Yopiq". */
export function formatDay(day: DayHours | undefined): string {
  if (day === undefined) return '—'
  const ranges = normalizeDay(day)
  if (!ranges.length) return 'Yopiq'
  return ranges.map(([o, c]) => `${o}–${c}`).join(', ')
}
