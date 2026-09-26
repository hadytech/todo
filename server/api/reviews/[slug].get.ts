import { db, dbConfigured } from '../../utils/db'
import { readerIdentity, GUEST_NAME } from '../../utils/identity'
import { wilson, display, type Stats } from '../../../lib/rating'
import { catalog } from '../../utils/catalog'

export interface ReviewRow {
  id: string
  rating: number
  body: string
  createdAt: string
  editedAt: string | null
  authorName: string
  /**
   * False when the review is signed by an account rather than a cookie.
   *
   * Sent to the client so the interface can label an anonymous review as
   * one. That is not a badge of shame, it is the honest answer to a name
   * nobody verified: without it, typing "Yalp.uz" into the name field
   * would borrow authority the site never granted.
   */
  guest: boolean
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
 * Read on the client rather than at prerender time: these change after the
 * build, and a review written on Tuesday should not wait for a deploy to
 * appear.
 *
 * A GET, so it mints nothing. Someone who has only ever read the site
 * arrives with no cookie, is given none here, and is simply not the author
 * of anything — which is the difference between identifying an author and
 * tracking a visitor.
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
  const me = await readerIdentity(event)

  type Raw = Omit<ReviewRow, 'myVote' | 'mine'> & { mine: boolean | null; myVote: number }
  const rows = await sql<Raw[]>`
    select r.id,
           r.rating,
           r.body,
           r.created_at as "createdAt",
           r.edited_at  as "editedAt",
           -- An account's name, else the name a guest typed, else the
           -- generic one. coalesce rather than three branches in JS so
           -- the column is never null on the wire.
           coalesce(u.name, r.author_name, ${GUEST_NAME}) as "authorName",
           (r.user_id is null) as "guest",
           (r.user_id = ${me?.user?.id ?? null}
             or r.author_key = ${me?.authorKey ?? null}) as "mine",
           coalesce(sum(case when v.value =  1 then 1 else 0 end), 0)::int as up,
           coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int as down,
           coalesce(max(case when v.voter = ${me?.voter ?? null} then v.value end), 0)::int as "myVote"
      from reviews r
      -- Left, not inner: an anonymous review has no user row, and an
      -- inner join here is how every guest review would silently vanish
      -- from the page while still counting in the average.
 left join users u on u.id = r.user_id
 left join votes v on v.review_id = r.id
     where r.business_slug = ${slug}
       and r.hidden_at is null
       and (u.id is null or u.blocked_at is null)
  group by r.id, u.name, u.id
  `

  /**
   * The headline numbers, from the rows above rather than a second query.
   *
   * They have to be the same set. A separate `select avg(rating)` looks
   * tidier and quietly disagrees with the list whenever the two WHERE
   * clauses drift apart — which they already had: the old query counted
   * reviews by blocked accounts into the average while the list left them
   * out, so a place could show "4.2 from 6 reviews" above five reviews.
   */
  const agg: Stats = {
    reviewCount: rows.length,
    ratingAvg: rows.length
      ? Math.round((rows.reduce((n, r) => n + r.rating, 0) / rows.length) * 100) / 100
      : 0,
  }

  const histogram = [0, 0, 0, 0, 0]
  for (const r of rows) histogram[r.rating - 1]! += 1

  const reviews: ReviewRow[] = rows
    // `mine` arrives as null when neither comparison applied — SQL's
    // three-valued logic, not an error.
    .map((r) => ({ ...r, mine: r.mine === true }))
    // Most useful first, not most recent: a thorough review that people
    // found helpful outlives the one posted an hour ago.
    .sort((a, b) =>
      wilson(b.up, b.down) - wilson(a.up, a.down)
      || +new Date(b.createdAt) - +new Date(a.createdAt))

  return { enabled: true, reviews, histogram, ...display(agg) }
})
