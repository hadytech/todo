import { describe, it, expect } from 'vitest'
import {
  bayesian, siteMean, display, wilson,
  MIN_REVIEWS_FOR_AVERAGE, PRIOR_WEIGHT, DEFAULT_MEAN,
} from './rating'

describe('bayesian', () => {
  it('returns the prior mean when there is nothing to go on', () => {
    expect(bayesian(0, 0)).toBe(DEFAULT_MEAN)
  })

  it('barely moves for a single review', () => {
    // The whole point. One five-star review must not produce a 5.0 that
    // outranks a place with two hundred reviews averaging 4.8.
    const one = bayesian(1, 5, 4.0)
    expect(one).toBeLessThan(4.2)
    expect(one).toBeGreaterThan(4.0)
  })

  it('lets a well-reviewed place beat a one-review perfect score', () => {
    const newcomer = bayesian(1, 5, 4.0)
    const established = bayesian(200, 4.8, 4.0)
    expect(established).toBeGreaterThan(newcomer)
  })

  it('converges on the true average as reviews accumulate', () => {
    expect(bayesian(5000, 3.2, 4.0)).toBeCloseTo(3.2, 2)
  })

  it('pulls a one-star newcomer up, not down to one', () => {
    expect(bayesian(1, 1, 4.0)).toBeGreaterThan(3.4)
  })

  it('weights the prior by exactly PRIOR_WEIGHT reviews', () => {
    // With count === weight the result sits halfway between the observed
    // average and the prior.
    expect(bayesian(PRIOR_WEIGHT, 2, 4.0)).toBeCloseTo(3.0, 6)
  })
})

describe('siteMean', () => {
  it('falls back to the default before any reviews exist', () => {
    expect(siteMean([])).toBe(DEFAULT_MEAN)
    expect(siteMean([{ reviewCount: 0, ratingAvg: 0 }])).toBe(DEFAULT_MEAN)
  })

  it('weights by review count, not by business', () => {
    // A place with 99 reviews at 5 and one with a single 1-star review
    // must not average to 3.
    const mean = siteMean([
      { reviewCount: 99, ratingAvg: 5 },
      { reviewCount: 1, ratingAvg: 1 },
    ])
    expect(mean).toBeCloseTo(4.96, 2)
  })
})

describe('display', () => {
  it('withholds the average below the threshold', () => {
    for (let n = 1; n < MIN_REVIEWS_FOR_AVERAGE; n++) {
      expect(display({ reviewCount: n, ratingAvg: 5 }).average).toBeNull()
    }
  })

  it('shows the real average once the threshold is met', () => {
    const d = display({ reviewCount: MIN_REVIEWS_FOR_AVERAGE, ratingAvg: 4.33 })
    expect(d.average).toBe(4.33)
    expect(d.count).toBe(MIN_REVIEWS_FOR_AVERAGE)
  })

  it('shows the honest average, never the ranking score', () => {
    // Sorting uses bayesian(); the page must show what people actually
    // gave. Displaying 4.1 when every reviewer said 5 would be a lie.
    const stats = { reviewCount: 4, ratingAvg: 5 }
    expect(display(stats).average).toBe(5)
    expect(bayesian(stats.reviewCount, stats.ratingAvg)).toBeLessThan(5)
  })

  it('handles a business with no reviews at all', () => {
    expect(display(undefined)).toEqual({ average: null, count: 0 })
  })
})

describe('wilson', () => {
  it('is zero with no votes', () => {
    expect(wilson(0, 0)).toBe(0)
  })

  it('ranks a well-supported review above a barely-voted one', () => {
    expect(wilson(40, 3)).toBeGreaterThan(wilson(1, 0))
  })

  it('never exceeds the observed proportion', () => {
    // It is a lower bound: it must stay under what was actually measured.
    expect(wilson(10, 0)).toBeLessThan(1)
    expect(wilson(7, 3)).toBeLessThan(0.7)
  })

  it('breaks a raw-difference tie in favour of the better-evidenced review', () => {
    // (up - down) scores both of these 1 and calls it a tie. 41-40 is a
    // genuinely divisive review eighty-one people weighed in on; 1-0 is
    // one person. Wilson ranks the first above the second.
    expect(wilson(41, 40)).toBeGreaterThan(wilson(1, 0))
  })

  it('discounts a small sample rather than trusting it', () => {
    // A lone upvote reads as 100% approval and must not score like it.
    expect(wilson(1, 0)).toBeLessThan(0.5)
    expect(wilson(50, 0)).toBeGreaterThan(0.9)
  })
})
