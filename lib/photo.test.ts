import { describe, it, expect } from 'vitest'
import { fitWithin, MAX_EDGE } from './photo'

describe('fitWithin', () => {
  it('scales a phone photo down to the long edge', () => {
    // A typical portrait shot, 4000x3000.
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_EDGE, height: 960 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: MAX_EDGE })
  })

  it('never enlarges a photo that is already small', () => {
    // Upscaling adds bytes and no detail.
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(MAX_EDGE, 400)).toEqual({ width: MAX_EDGE, height: 400 })
  })

  it('keeps the aspect ratio', () => {
    const r = fitWithin(4000, 2250)
    expect(r.width / r.height).toBeCloseTo(4000 / 2250, 2)
  })

  it('never rounds a dimension to zero', () => {
    // A canvas with a zero dimension throws. An extreme panorama is the
    // case that gets there.
    const r = fitWithin(20000, 5)
    expect(r.height).toBeGreaterThanOrEqual(1)
    expect(r.width).toBe(MAX_EDGE)
  })

  it('handles a degenerate size without producing NaN', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 })
    expect(fitWithin(-5, 10)).toEqual({ width: 0, height: 0 })
  })
})
