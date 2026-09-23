import { z } from 'zod'
import { db } from '../../utils/db'
import { hashToken, newToken, LOGIN_TOKEN_TTL_MIN } from '../../utils/auth'
import { loginMail, sendMail } from '../../utils/mail'
import { checkLoginRate, clientIp } from '../../utils/ratelimit'

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  /**
   * Only used the first time an address is seen. Sending it on every
   * request would let anyone rename an existing account by asking for a
   * login link to their address.
   */
  name: z.string().trim().min(2).max(40).optional(),
})

export default defineEventHandler(async (event) => {
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elektron pocta manzili notöğri' })
  }
  const { email, name } = parsed.data

  const ip = clientIp(event)
  await checkLoginRate(email, ip)

  const token = newToken()
  const sql = db()

  await sql`
    insert into login_tokens (token_hash, email, expires_at, request_ip)
    values (
      ${hashToken(token)},
      ${email},
      now() + ${`${LOGIN_TOKEN_TTL_MIN} minutes`}::interval,
      ${ip}
    )
  `

  // The name travels in the link, not in the database, because the
  // account does not exist yet and an unverified address must not be
  // able to create one.
  const base = useRuntimeConfig(event).public.siteUrl
  const url = new URL('/api/auth/verify', base)
  url.searchParams.set('token', token)
  if (name) url.searchParams.set('name', name)

  await sendMail(loginMail(email, url.toString(), LOGIN_TOKEN_TTL_MIN))

  /**
   * Always the same answer, whether or not this address has an account.
   * Anything else turns the login form into a way to ask the site who is
   * registered on it.
   *
   * The link is never returned here — in development it goes to the
   * server log. A link in an HTTP response would let anyone log in as
   * anyone by typing their address.
   */
  return { ok: true }
})
