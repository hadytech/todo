import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Who may work the suggestions queue.
 *
 * A shared token in `ADMIN_TOKEN`, exchanged once for a cookie. Not the
 * most sophisticated thing that could be built, and deliberately: the
 * alternative on the table was "sign in by email, then check the address
 * against a list", which needs mail delivery to be working before anybody
 * can approve anything — and mail is the part most likely to be broken on
 * a new deployment.
 *
 * A token in a link works from a phone, needs no other service, and can
 * be rotated by editing one environment variable.
 *
 * What keeps it honest:
 *   - Compared in constant time, against the SHA-256 of both sides, so a
 *     length difference cannot be measured either.
 *   - Exchanged immediately for an httpOnly cookie, so the token appears
 *     in one URL once rather than in every link thereafter.
 *   - With no ADMIN_TOKEN set, there is no way in at all. An absent
 *     secret must never mean an open door.
 */
export const ADMIN_COOKIE = 'yalp_admin'
const TTL_DAYS = 30

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN)
}

/** True when `candidate` is the configured token. */
export function tokenMatches(candidate: string): boolean {
  const secret = process.env.ADMIN_TOKEN
  if (!secret || !candidate) return false
  // Hashing first makes both sides the same length, so timingSafeEqual
  // cannot throw and the comparison leaks nothing about the length.
  return timingSafeEqual(digest(candidate), digest(secret))
}

export function isAdmin(event: Parameters<typeof getCookie>[0]): boolean {
  const cookie = getCookie(event, ADMIN_COOKIE)
  return Boolean(cookie && tokenMatches(cookie))
}

export function requireAdmin(event: Parameters<typeof getCookie>[0]): void {
  if (!isAdmin(event)) {
    // 404, not 403: an endpoint that says "wrong password" has confirmed
    // it exists and is worth attacking.
    throw createError({ statusCode: 404, statusMessage: 'Topilmadi' })
  }
}

export function setAdminCookie(event: Parameters<typeof setCookie>[0], token: string): void {
  setCookie(event, ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_DAYS * 24 * 60 * 60,
  })
}

export function clearAdminCookie(event: Parameters<typeof setCookie>[0]): void {
  setCookie(event, ADMIN_COOKIE, '', { path: '/', maxAge: 0 })
}
