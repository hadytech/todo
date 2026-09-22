/**
 * Turning a pile of stars into one number people can compare.
 *
 * The naive average is the wrong tool for a young directory. A place with
 * one five-star review outranks a place with two hundred reviews
 * averaging 4.8, which is both obviously false and trivially gamed: one
 * account, one review, top of the list.
 */

/**
 * Reviews required before an average is shown at all.
 *
 * Below this the page shows the individual reviews and no headline score.
 * A single opinion is worth reading and is not worth a number that looks
 * like a measurement.
 */
export const MIN_REVIEWS_FOR_AVERAGE = 3

/**
 * Prior weight, in reviews.
 *
 * A place starts out treated as if it already had this many reviews at
 * the site-wide mean, and real reviews pull it away. Five is about right
 * for a directory this size: three genuine reviews move the score
 * noticeably, one does almost nothing.
 */
export const PRIOR_WEIGHT = 5

/** Fallback site mean before there is enough data to measure one. */
export const DEFAULT_MEAN = 4.0

/**
 * Bayesian average — the number things are *sorted* by.
 *
 * (count x average + weight x mean) / (count + weight)
 *
 * This is the same shape IMDb uses for its top 250 and for the same
 * reason. Note it is a ranking score, not a display score: showing a
 * place's stars as 4.1 when every reviewer gave 5 would be a lie about
 * what people said. Display `average`, sort by this.
 */
export function bayesian(count: number, average: number, mean = DEFAULT_MEAN, weight = PRIOR_WEIGHT): number {
  if (count <= 0) return mean
  return (count * average + weight * mean) / (count + weight)
}

/** The site-wide mean rating, for use as the prior. */
export function siteMean(rows: { reviewCount: number; ratingAvg: number }[]): number {
  const n = rows.reduce((a, r) => a + r.reviewCount, 0)
  if (n === 0) return DEFAULT_MEAN
  const total = rows.reduce((a, r) => a + r.reviewCount * r.ratingAvg, 0)
  return total / n
}

export interface Stats {
  reviewCount: number
  ratingAvg: number
}

/**
 * What the UI is allowed to render.
 *
 * `average` is null below the threshold — deliberately, so a component
 * cannot accidentally display a one-review score by reading a field that
 * happened to be populated.
 */
export function display(stats: Stats | undefined): { average: number | null; count: number } {
  const count = stats?.reviewCount ?? 0
  return {
    count,
    average: count >= MIN_REVIEWS_FOR_AVERAGE ? (stats!.ratingAvg ?? null) : null,
  }
}

/**
 * Net score of a review's votes, and the order reviews are shown in.
 *
 * Wilson lower bound rather than (up - down): with few votes the naive
 * difference is noise, and a review with 1 up and 0 down should not
 * outrank one with 40 up and 3 down. z = 1.96, the 95% bound.
 */
export function wilson(up: number, down: number): number {
  const n = up + down
  if (n === 0) return 0
  const z = 1.96
  const p = up / n
  const denom = 1 + (z * z) / n
  const centre = p + (z * z) / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)
  return (centre - margin) / denom
}
