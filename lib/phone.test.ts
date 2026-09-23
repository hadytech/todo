import { describe, it, expect } from 'vitest'
import { normalisePhone, isNormalised } from './phone'

describe('normalisePhone', () => {
  it('accepts every shape a person actually types', () => {
    for (const input of [
      '+998 90 123 45 67',
      '+998901234567',
      '998901234567',
      '901234567',
      '90 123 45 67',
      '(90) 123-45-67',
      '90-123-45-67',
      '+998 (90) 123 45 67',
    ]) {
      expect(normalisePhone(input)).toBe('+998 90 123 45 67')
    }
  })

  it('produces something the YAML schema will accept', () => {
    expect(isNormalised(normalisePhone('901234567'))).toBe(true)
  })

  it('hands back anything it cannot parse, rather than mangling it', () => {
    // Too short to be a number, but it may be a real fragment worth a
    // human look — dropping it loses information the submitter gave us.
    expect(normalisePhone('12345')).toBe('12345')
    expect(normalisePhone('qönğiroq qiling')).toBe('qönğiroq qiling')
  })

  it('does not invent a number from nothing', () => {
    expect(normalisePhone(undefined)).toBeUndefined()
    expect(normalisePhone(null)).toBeUndefined()
    expect(normalisePhone('')).toBeUndefined()
  })

  it('does not treat a 998 inside a local number as a country code', () => {
    // 998123456 is nine digits already — stripping a "998" prefix would
    // leave six and silently pass through as unparseable.
    expect(normalisePhone('998123456')).toBe('+998 99 812 34 56')
  })

  it('rejects a number that is too long to be Uzbek', () => {
    expect(isNormalised(normalisePhone('+1 415 555 0123'))).toBe(false)
  })
})
