import { db } from './db'
import { tashkentDayStart } from './privacy'

/**
 * Rate limiting, in Postgres, against pseudonyms.
 *
 * Redis would be the usual answer and would cost money, so the limits are
 * counted against rows that have to exist anyway. That makes them exact
 * rather than approximate, and it makes them survive a cold start, which
 * an in-memory counter in a serverless function does not.
 *
 * Every limit below counts a daily pseudonym, never an address — see
 * lib/privacy.ts. That has one visible consequence worth stating plainly:
 * the windows are calendar days in Tashkent, not rolling 24-hour windows,
 * because yesterday's pseudonym is unrecognisable today. A limit that
 * resets at local midnight is what the scheme can honestly express, and
 * it is also what a person would assume.
 *
 * Anonymous writing is what these numbers are really protecting, so they
 * are set where a person never notices them and a script does. They are
 * deliberately not the last line of defence: `hidden_at` on a review and
 * the submissions inbox are, because a limit low enough to stop a
 * determined spammer is low enough to stop a neighbourhood enthusiast,
 * and the second one is who this directory is for.
 */

/** Magic links per address per hour. */
const PER_EMAIL_HOURLY = 5
/** Magic links per source network per hour, across all addresses. */
const PER_IP_HOURLY = 20

/**
 * Throws 429 if this email or network has asked for too many links lately.
 *
 * Both limits matter and they catch different abuse: the per-email limit
 * stops someone's inbox being used as a weapon, the per-network limit
 * stops one script enumerating many addresses.
 */
export async function checkLoginRate(email: string, requestKey: string): Promise<void> {
  const sql = db()
  const [row] = await sql<{ by_email: number; by_key: number }[]>`
    select
      count(*) filter (where email = ${email})            ::int as by_email,
      count(*) filter (where request_key = ${requestKey}) ::int as by_key
    from login_tokens
    where created_at > now() - interval '1 hour'
  `
  if (!row) return
  if (row.by_email >= PER_EMAIL_HOURLY || row.by_key >= PER_IP_HOURLY) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Juda köp uriniş. Bir ozdan keyin qayta urinib köring.',
    })
  }
}

/** Reviews one author may write in a day. Generous; a real person hits nothing. */
const REVIEWS_PER_AUTHOR = 10
/**
 * Reviews from one network in a day.
 *
 * Higher than the per-author figure and still not high: a Tashkent home
 * connection is often one NAT for a building, and an office is one for a
 * floor, so this cannot be tight without punishing exactly the places
 * where several people would plausibly review the same café.
 */
const REVIEWS_PER_NETWORK = 30

/**
 * Throttles review writing, by author and by network.
 *
 * `author` is a durable identity — an account id or an anonymous cookie's
 * key — and stops one person carpet-bombing the directory. `writerKey` is
 * today's network pseudonym and stops one script doing it from behind a
 * hundred cleared cookies, which the author limit cannot see.
 */
export async function checkReviewRate(author: string, writerKey: string): Promise<void> {
  const sql = db()
  const since = tashkentDayStart()
  const [row] = await sql<{ by_author: number; by_network: number }[]>`
    select
      count(*) filter (where user_id::text = ${author} or author_key = ${author}) ::int as by_author,
      count(*) filter (where writer_key = ${writerKey})                          ::int as by_network
      from reviews
     where created_at >= ${since}
  `
  if ((row?.by_author ?? 0) >= REVIEWS_PER_AUTHOR) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Bugunga yetarli şarh yozildi. Ertaga davom eting.',
    })
  }
  if ((row?.by_network ?? 0) >= REVIEWS_PER_NETWORK) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Bu tarmoqdan bugun köp şarh keldi. Ertaga urinib köring.',
    })
  }
}

/** Submissions accepted from one network in a day. */
const SUBMISSIONS_DAILY = 15

/**
 * Throttles anonymous submissions.
 *
 * The limit is generous because the failure modes are asymmetric: a
 * neighbourhood enthusiast adding fifteen shops in an evening is the best
 * thing that can happen to this directory, and a bot that gets fifteen
 * rows in before being stopped has cost a maintainer one glance at
 * `npm run submissions`.
 */
export async function checkSubmissionRate(submitterKey: string): Promise<void> {
  const sql = db()
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n
      from submissions
     where submitter_key = ${submitterKey}
       and created_at >= ${tashkentDayStart()}
  `
  if ((row?.n ?? 0) >= SUBMISSIONS_DAILY) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Bugunga yetarli taklif yuborildi. Ertaga davom eting.',
    })
  }
}
