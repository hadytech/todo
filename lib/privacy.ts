import { createHash, createHmac } from 'node:crypto'

/**
 * Turning an IP address into something that can be counted but not read.
 *
 * Rate limiting needs to recognise a repeat visitor. It does not need to
 * know who they are, and storing the address so it can tell would mean
 * this database holds a log of which network read which page — the exact
 * record that gets demanded later, and the one thing a directory of
 * opinions must not be able to hand over.
 *
 * So the address is never stored. What is stored is
 * `HMAC(secret, day + ':' + address)`, which has three properties that
 * matter:
 *
 *   - It cannot be reversed. Not because a hash is magic — the IPv4
 *     space is four billion entries and a laptop walks it in seconds —
 *     but because the HMAC key is not in the database. A stolen dump is
 *     a column of noise.
 *   - It rotates daily, so two visits a week apart cannot be linked to
 *     each other even by someone who does hold the key.
 *   - It is stable within the day, which is all a daily limit needs.
 *
 * The rotation is the reason limits are per calendar day in Tashkent
 * rather than per rolling 24 hours: yesterday's keys are unrecognisable
 * today, so a rolling window is not something this scheme can express.
 * A limit that resets at local midnight is the honest version of that,
 * and it is also the version a person would guess.
 */

/** Tashkent is UTC+5 all year. No daylight saving to get wrong. */
const TASHKENT_OFFSET_MIN = 5 * 60

/** The calendar date in Tashkent, as YYYY-MM-DD. */
export function tashkentDay(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TASHKENT_OFFSET_MIN * 60_000)
  return shifted.toISOString().slice(0, 10)
}

/**
 * The instant local midnight began, in UTC.
 *
 * Rate-limit queries count from here rather than `now() - interval '1
 * day'`, so the window the SQL asks about is exactly the window the key
 * can answer for. Mismatching the two is how a limit silently stops
 * applying for the first hours after midnight.
 */
export function tashkentDayStart(now: Date = new Date()): Date {
  const day = tashkentDay(now)
  const localMidnight = new Date(`${day}T00:00:00.000Z`).getTime()
  return new Date(localMidnight - TASHKENT_OFFSET_MIN * 60_000)
}

/**
 * A per-day pseudonym for `value` under `secret`.
 *
 * 128 bits of the digest, which is far past the point where a collision
 * would matter for counting, and half the column width of the full one.
 */
export function dailyKey(secret: string, value: string, now: Date = new Date()): string {
  return createHmac('sha256', secret)
    .update(`${tashkentDay(now)}:${value}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * The HMAC key, derived from whatever secret the deployment has.
 *
 * `IP_SALT` if it is set. Otherwise the database URL, which is a secret
 * the deployment must already hold and — importantly — one that is not
 * inside the database it points at. That is what keeps a leaked dump
 * un-reversible without asking anyone to configure a second variable
 * they would forget, and it is why the derivation is a hash rather than
 * the URL itself: nothing should be able to print the credential back
 * out.
 *
 * With neither, there is nothing durable to key on, so a random value is
 * used and limits last only as long as the process. That case is local
 * development, where there is no database either.
 */
let fallback: string | null = null

export function ipSecret(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.IP_SALT
  if (explicit) return createHash('sha256').update(explicit).digest('hex')
  const url = env.DATABASE_URL
  if (url) return createHash('sha256').update(`yalp-ip:${url}`).digest('hex')
  fallback ??= createHash('sha256').update(String(Math.random())).digest('hex')
  return fallback
}
