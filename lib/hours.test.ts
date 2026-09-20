import { describe, it, expect } from 'vitest'
import { normalizeDay, isOpenAt, formatDay, toMinutes, weekdayOf, tashkentNow } from './hours'

/** A Tashkent wall-clock time, expressed as the UTC instant it happens. */
const at = (weekday: number, hh: number, mm = 0) =>
  // 2026-09-21 is a Monday. UTC+5, so subtract 5 hours to get the instant.
  new Date(Date.UTC(2026, 8, 21 + weekday, hh - 5, mm))

describe('normalizeDay', () => {
  it('accepts all three shapes', () => {
    expect(normalizeDay('closed')).toEqual([])
    expect(normalizeDay(undefined)).toEqual([])
    expect(normalizeDay(['09:00', '22:00'])).toEqual([['09:00', '22:00']])
    expect(normalizeDay([['09:00', '15:00'], ['18:00', '23:00']]))
      .toEqual([['09:00', '15:00'], ['18:00', '23:00']])
  })
})

describe('isOpenAt — a day with a lunch break', () => {
  const hours = { mon: [['09:00', '15:00'], ['18:00', '23:00']] as [string, string][] }

  it('is open during the morning range', () => {
    expect(isOpenAt(hours, tashkentNow(at(0, 10)))).toBe(true)
  })

  it('is CLOSED during the break — the case a single range cannot express', () => {
    expect(isOpenAt(hours, tashkentNow(at(0, 16)))).toBe(false)
  })

  it('is open again in the evening', () => {
    expect(isOpenAt(hours, tashkentNow(at(0, 19)))).toBe(true)
  })

  it('is closed on a day with no entry', () => {
    expect(isOpenAt(hours, tashkentNow(at(2, 12)))).toBe(false)
  })
})

describe('isOpenAt — boundaries', () => {
  const hours = { mon: ['09:00', '22:00'] as [string, string] }

  it('opens exactly at the opening minute', () => {
    expect(isOpenAt(hours, tashkentNow(at(0, 9, 0)))).toBe(true)
  })

  it('is shut at the closing minute, not a minute later', () => {
    expect(isOpenAt(hours, tashkentNow(at(0, 21, 59)))).toBe(true)
    expect(isOpenAt(hours, tashkentNow(at(0, 22, 0)))).toBe(false)
  })

  it('handles a business open until midnight via 24:00', () => {
    const late = { mon: ['18:00', '24:00'] as [string, string] }
    expect(isOpenAt(late, tashkentNow(at(0, 23, 59)))).toBe(true)
  })

  it('handles a 24-hour business', () => {
    const always = { mon: ['00:00', '24:00'] as [string, string] }
    expect(isOpenAt(always, tashkentNow(at(0, 3)))).toBe(true)
  })

  it('returns null when no hours are published, so the UI can say nothing', () => {
    expect(isOpenAt(undefined, new Date())).toBeNull()
    expect(isOpenAt({}, new Date())).toBeNull()
  })
})

describe('tashkentNow', () => {
  it('reads the same wall clock regardless of the visitor timezone', () => {
    // 07:00 UTC is 12:00 in Tashkent, whatever the browser thinks.
    expect(tashkentNow(new Date('2026-09-21T07:00:00Z')).getHours()).toBe(12)
  })

  it('maps Monday to the first weekday', () => {
    expect(weekdayOf(tashkentNow(new Date('2026-09-21T07:00:00Z')))).toBe('mon')
  })
})

describe('formatDay', () => {
  it('joins multiple ranges', () => {
    expect(formatDay([['09:00', '15:00'], ['18:00', '23:00']])).toBe('09:00–15:00, 18:00–23:00')
  })
  it('renders a single range, closed and unknown', () => {
    expect(formatDay(['09:00', '22:00'])).toBe('09:00–22:00')
    expect(formatDay('closed')).toBe('Yopiq')
    expect(formatDay(undefined)).toBe('—')
  })
})

describe('toMinutes', () => {
  it('treats 24:00 as the end of the day', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('24:00')).toBe(1440)
  })
})
