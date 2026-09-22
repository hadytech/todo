import { db } from './db'

/**
 * Rate limiting, in Postgres.
 *
 * Redis would be the usual answer and would cost money, so the limits
 * are counted against rows that have to exist anyway. That makes them
 * exact rather than approximate, and it makes them survive a cold start,
 * which an in-memory counter in a serverless function does not.
 */

/** Magic links per address per hour. */
const PER_EMAIL_HOURLY = 5
/** Magic links per source address per hour, across all addresses. */
const PER_IP_HOURLY = 20

/**
 * The caller's IP, as far as it can be known behind a proxy.
 *
 * `x-forwarded-for` is a list the proxy appends to, so the leftmost entry
 * is the client — and is also the only part a client can forge. That is
 * acceptable for throttling free email sends; it would not be acceptable
 * as an authorisation signal, and it is not used as one.
 */
export function clientIp(event: Parameters<typeof getRequestHeader>[0]): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return getRequestHeader(event, 'x-real-ip')
    || event.node?.req?.socket?.remoteAddress
    || 'unknown'
}

/**
 * Throws 429 if this email or IP has asked for too many links lately.
 *
 * Both limits matter and they catch different abuse: the per-email limit
 * stops someone's inbox being used as a weapon, the per-IP limit stops
 * one script enumerating many addresses.
 */
export async function checkLoginRate(email: string, ip: string): Promise<void> {
  const sql = db()
  const [row] = await sql<{ by_email: number; by_ip: number }[]>`
    select
      count(*) filter (where email = ${email})     ::int as by_email,
      count(*) filter (where request_ip = ${ip})   ::int as by_ip
    from login_tokens
    where created_at > now() - interval '1 hour'
  `
  if (!row) return
  if (row.by_email >= PER_EMAIL_HOURLY || row.by_ip >= PER_IP_HOURLY) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Juda koʻp uriniş. Bir ozdan keyin qayta urinib koʻring.',
    })
  }
}

/** Reviews one account may write per day. Generous; a real person hits nothing. */
const REVIEWS_DAILY = 10

export async function checkReviewRate(userId: string): Promise<void> {
  const sql = db()
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n
      from reviews
     where user_id = ${userId}
       and created_at > now() - interval '1 day'
  `
  if ((row?.n ?? 0) >= REVIEWS_DAILY) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Bugunga yetarli. Ertaga davom eting.',
    })
  }
}

/** Submissions accepted from one address per day. */
const SUBMISSIONS_DAILY = 15

/**
 * Throttles anonymous submissions.
 *
 * The limit is generous because the failure modes are asymmetric: a
 * neighbourhood enthusiast adding fifteen shops in an evening is the
 * best thing that can happen to this directory, and a bot that gets
 * fifteen rows in before being stopped has cost a maintainer one glance
 * at `npm run submissions`.
 */
export async function checkSubmissionRate(ip: string): Promise<void> {
  const sql = db()
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n
      from submissions
     where submitted_ip = ${ip}
       and created_at > now() - interval '1 day'
  `
  if ((row?.n ?? 0) >= SUBMISSIONS_DAILY) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Bugunga yetarli taklif yuborildi. Ertaga davom eting.',
    })
  }
}
