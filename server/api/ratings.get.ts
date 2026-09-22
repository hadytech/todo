import { db, dbConfigured } from '../utils/db'
import { bayesian, display, siteMean, type Stats } from '../../lib/rating'

/**
 * Headline numbers for every reviewed place, in one query.
 *
 * The listing pages need a score per card. Asking per card would be one
 * round trip per row on a cold serverless function, so the whole table is
 * returned at once — it is one small row per reviewed business, and the
 * directory would have to grow by two orders of magnitude before that
 * stopped being the cheaper shape.
 */
export default defineEventHandler(async () => {
  if (!dbConfigured()) return { enabled: false, items: {} as Record<string, unknown> }

  const rows = await db()<(Stats & { slug: string })[]>`
    select business_slug as slug,
           review_count  as "reviewCount",
           rating_avg    as "ratingAvg"
      from review_stats
  `

  // The prior is the site's own mean, not a guess, once there is enough
  // data to have one.
  const mean = siteMean(rows)

  const items: Record<string, { average: number | null; count: number; rank: number }> = {}
  for (const r of rows) {
    items[r.slug] = { ...display(r), rank: bayesian(r.reviewCount, r.ratingAvg, mean) }
  }

  return { enabled: true, mean, items }
})
