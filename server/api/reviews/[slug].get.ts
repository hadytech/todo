import { db, dbConfigured } from '../../utils/db'
import { currentUser } from '../../utils/auth'
import { wilson, display, type Stats } from '../../../lib/rating'
import { catalog } from '../../utils/catalog'

export interface ReviewRow {
  id: string
  rating: number
  body: string
  createdAt: string
  editedAt: string | null
  authorName: string
  up: number
  down: number
  /** This visitor's vote on this review: 1, -1, or 0 for none. */
  myVote: number
  /** True when this visitor wrote it — the UI offers edit and delete. */
  mine: boolean
}

/**
 * Every visible review for one business, plus the headline numbers.
 *
 * Read on the client rather than at prerender time: these change after
 * the build, and a review written on Tuesday should not wait for a
 * deploy to appear.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug kerak' })

  // A review is only meaningful against a listing that exists. Without
  // this the endpoint is an open write target for arbitrary keys.
  if (!catalog.businesses.some((b) => b.slug === slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Joy topilmadi' })
  }

  if (!dbConfigured()) {
    return { enabled: false, reviews: [], count: 0, average: null, histogram: [0, 0, 0, 0, 0] }
  }

  const sql = db()
  const me = await currentUser(event)

  const rows = await sql<(Omit<ReviewRow, 'myVote' | 'mine'> & { userId: string; myVote: number })[]>`
    select r.id,
           r.rating,
           r.body,
           r.created_at as "createdAt",
           r.edited_at  as "editedAt",
           r.user_id    as "userId",
           u.name       as "authorName",
           coalesce(sum(case when v.value =  1 then 1 else 0 end), 0)::int as up,
           coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int as down,
           coalesce(max(case when v.user_id = ${me?.id ?? null} then v.value end), 0)::int as "myVote"
      from reviews r
      join users u on u.id = r.user_id
 left join votes v on v.review_id = r.id
     where r.business_slug = ${slug}
       and r.hidden_at is null
  group by r.id, u.name
  `

  const [agg] = await sql<Stats[]>`
    select count(*)::int as "reviewCount",
           coalesce(round(avg(rating)::numeric, 2), 0)::float as "ratingAvg"
      from reviews
     where business_slug = ${slug} and hidden_at is null
  `

  const histogram = [0, 0, 0, 0, 0]
  for (const r of rows) histogram[r.rating - 1]! += 1

  const reviews: ReviewRow[] = rows
    .map(({ userId, ...r }) => ({ ...r, mine: Boolean(me && me.id === userId) }))
    // Most useful first, not most recent: a thorough review that people
    // found helpful outlives the one posted an hour ago.
    .sort((a, b) =>
      wilson(b.up, b.down) - wilson(a.up, a.down)
      || +new Date(b.createdAt) - +new Date(a.createdAt))

  return { enabled: true, reviews, histogram, ...display(agg) }
})
