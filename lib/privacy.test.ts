import { describe, expect, it } from 'vitest'
import { dailyKey, ipSecret, tashkentDay, tashkentDayStart } from './privacy'

const at = (iso: string) => new Date(iso)

describe('tashkentDay', () => {
  it('rolls over at local midnight, not UTC midnight', () => {
    // Tashkent is UTC+5, so the day changes at 19:00 the previous day in
    // UTC. Getting this backwards would reset every daily limit at 5am
    // local, in the middle of the night for nobody's convenience.
    expect(tashkentDay(at('2026-09-26T18:59:59Z'))).toBe('2026-09-26')
    expect(tashkentDay(at('2026-09-26T19:00:00Z'))).toBe('2026-09-27')
  })

  it('has no daylight saving to get wrong', () => {
    // Uzbekistan abolished it in 1991. Both of these are +5.
    expect(tashkentDay(at('2026-01-15T19:00:00Z'))).toBe('2026-01-16')
    expect(tashkentDay(at('2026-07-15T19:00:00Z'))).toBe('2026-07-16')
  })
})

describe('tashkentDayStart', () => {
  it('is the instant the local day began', () => {
    expect(tashkentDayStart(at('2026-09-26T12:00:00Z')).toISOString())
      .toBe('2026-09-25T19:00:00.000Z')
  })

  it('agrees with tashkentDay at every hour of the day', () => {
    // The two have to describe the same window: the SQL counts from the
    // day start while the key is derived from the day name, and a
    // mismatch means a limit that quietly stops applying.
    for (let h = 0; h < 24; h += 1) {
      const now = at(`2026-09-26T${String(h).padStart(2, '0')}:30:00Z`)
      expect(tashkentDay(tashkentDayStart(now))).toBe(tashkentDay(now))
      expect(tashkentDayStart(now).getTime()).toBeLessThanOrEqual(now.getTime())
    }
  })
})

describe('dailyKey', () => {
  const secret = 'a'.repeat(64)

  it('is stable within the day and different the next', () => {
    const today = dailyKey(secret, '84.54.1.2', at('2026-09-26T08:00:00Z'))
    expect(dailyKey(secret, '84.54.1.2', at('2026-09-26T17:00:00Z'))).toBe(today)
    expect(dailyKey(secret, '84.54.1.2', at('2026-09-27T08:00:00Z'))).not.toBe(today)
  })

  it('separates addresses', () => {
    const now = at('2026-09-26T08:00:00Z')
    expect(dailyKey(secret, '84.54.1.2', now)).not.toBe(dailyKey(secret, '84.54.1.3', now))
  })

  it('changes completely when the secret changes', () => {
    // The whole un-reversibility argument rests on this: a dump without
    // the key is noise, so the key must be what decides the output.
    const now = at('2026-09-26T08:00:00Z')
    expect(dailyKey(secret, '84.54.1.2', now))
      .not.toBe(dailyKey('b'.repeat(64), '84.54.1.2', now))
  })

  it('does not carry the address, the date or the secret in its output', () => {
    const key = dailyKey(secret, '84.54.1.2', at('2026-09-26T08:00:00Z'))
    expect(key).toMatch(/^[0-9a-f]{32}$/)
    // Only whole values: a two-character substring turns up in 32 hex
    // digits by chance, which would make this test fail on luck.
    for (const leak of ['84.54.1.2', '2026-09-26', secret]) {
      expect(key.includes(leak)).toBe(false)
    }
  })

  it('handles IPv6 and the unknown case without special-casing', () => {
    const now = at('2026-09-26T08:00:00Z')
    expect(dailyKey(secret, '2001:db8::1', now)).toMatch(/^[0-9a-f]{32}$/)
    expect(dailyKey(secret, 'unknown', now)).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('ipSecret', () => {
  it('prefers IP_SALT', () => {
    const a = ipSecret({ IP_SALT: 'one', DATABASE_URL: 'postgres://x' })
    const b = ipSecret({ IP_SALT: 'two', DATABASE_URL: 'postgres://x' })
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('falls back to the database URL, which a dump does not contain', () => {
    const a = ipSecret({ DATABASE_URL: 'postgres://u:pw1@host/db' })
    const b = ipSecret({ DATABASE_URL: 'postgres://u:pw2@host/db' })
    expect(a).not.toBe(b)
  })

  it('never returns the credential it was derived from', () => {
    const url = 'postgres://user:hunter2@ep-x.eu-central-1.aws.neon.tech/yalp'
    const secret = ipSecret({ DATABASE_URL: url })
    expect(secret.includes('hunter2')).toBe(false)
    expect(secret.includes('neon')).toBe(false)
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
  })

  it('still returns something with nothing configured', () => {
    // Local development, where there is no database either. Limits last
    // as long as the process and that is the correct answer.
    expect(ipSecret({})).toMatch(/^[0-9a-f]{64}$/)
    expect(ipSecret({})).toBe(ipSecret({}))
  })
})
