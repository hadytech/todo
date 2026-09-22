import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from './db'

/** How long a magic link stays usable. Long enough to switch apps. */
export const LOGIN_TOKEN_TTL_MIN = 20
/** How long a login lasts before it has to be repeated. */
export const SESSION_TTL_DAYS = 90

export const SESSION_COOKIE = 'yalp_session'

/**
 * Tokens are stored hashed, never raw.
 *
 * SHA-256 with no salt is right here and wrong for passwords: these are
 * 256 bits of CSPRNG output, so there is no dictionary to attack and no
 * work factor worth paying. What matters is that a leaked database row
 * cannot be replayed as a credential.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Constant-time compare, for anything derived from user input. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export interface SessionUser {
  id: string
  email: string
  name: string
}

/**
 * The signed-in user, or null.
 *
 * Expiry is enforced in the query rather than in JavaScript so a clock
 * skew between app and database cannot extend a session, and a blocked
 * account stops being able to act the moment it is blocked.
 */
export async function currentUser(event: Parameters<typeof getCookie>[0]): Promise<SessionUser | null> {
  const raw = getCookie(event, SESSION_COOKIE)
  if (!raw) return null

  const sql = db()
  const rows = await sql<SessionUser[]>`
    select u.id, u.email, u.name
      from sessions s
      join users u on u.id = s.user_id
     where s.token_hash = ${hashToken(raw)}
       and s.expires_at > now()
       and u.blocked_at is null
     limit 1
  `
  return rows[0] ?? null
}

/** As `currentUser`, but 401s instead of returning null. */
export async function requireUser(event: Parameters<typeof getCookie>[0]): Promise<SessionUser> {
  const user = await currentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Avval kiriş kerak' })
  }
  return user
}

export function setSessionCookie(event: Parameters<typeof setCookie>[0], token: string): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax, not Strict: the magic link arrives from the visitor's mail
    // client, which is a cross-site navigation. Strict would drop the
    // cookie on exactly the request that creates it.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(event: Parameters<typeof setCookie>[0]): void {
  setCookie(event, SESSION_COOKIE, '', { path: '/', maxAge: 0 })
}
