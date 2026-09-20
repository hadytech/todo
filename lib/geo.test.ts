import { describe, it, expect } from 'vitest'
import { distanceMetres, formatDistance, inTashkent } from './geo'

const CHORSU = { lat: 41.3264, lng: 69.2347 }
const AMIR_TEMUR = { lat: 41.3111, lng: 69.2797 }

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    expect(distanceMetres(CHORSU, CHORSU)).toBe(0)
  })

  it('matches a known Tashkent distance', () => {
    // Chorsu to Amir Temur square is a little over 4km.
    const d = distanceMetres(CHORSU, AMIR_TEMUR)
    expect(d).toBeGreaterThan(4_000)
    expect(d).toBeLessThan(4_800)
  })

  it('is symmetric', () => {
    expect(distanceMetres(CHORSU, AMIR_TEMUR)).toBeCloseTo(distanceMetres(AMIR_TEMUR, CHORSU), 6)
  })

  it('does not produce NaN for antipodal points', () => {
    // The sqrt argument can drift above 1 through floating point; asin
    // of anything over 1 is NaN, which would silently poison sorting.
    expect(distanceMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).not.toBeNaN()
  })
})

describe('formatDistance', () => {
  it('rounds metres to the nearest ten', () => {
    expect(formatDistance(447)).toBe('450 m')
    expect(formatDistance(12)).toBe('10 m')
  })

  it('uses a comma decimal separator under 10km', () => {
    expect(formatDistance(1234)).toBe('1,2 km')
  })

  it('drops the decimal above 10km, where it is false precision', () => {
    expect(formatDistance(12_340)).toBe('12 km')
  })
})

describe('inTashkent', () => {
  it('accepts a city point and rejects a distant one', () => {
    expect(inTashkent(CHORSU)).toBe(true)
    expect(inTashkent({ lat: 39.65, lng: 66.96 })).toBe(false) // Samarqand
  })
})
