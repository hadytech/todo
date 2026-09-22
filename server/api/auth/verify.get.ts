import { z } from 'zod'
import { db } from '../../utils/db'
import { hashToken, newToken, setSessionCookie, SESSION_TTL_DAYS } from '../../utils/auth'

const Query = z.object({
  token: z.string().min(10).max(200),
  name: z.string().trim().min(2).max(40).optional(),
})

/** Sends the visitor back to the site with a message, never a blank page. */
function back(event: Parameters<typeof sendRedirect>[0], status: string, to = '/') {
  const target = `${to}${to.includes('?') ? '&' : '?'}kirish=${status}`
  return sendRedirect(event, target, 302)
}

export default defineEventHandler(async (event) => {
  const parsed = Query.safeParse(getQuery(event))
  if (!parsed.success) return back(event, 'xato', '/kirish')

  const { token, name } = parsed.data
  const sql = db()

  /**
   * One transaction, and the token is consumed by the same statement that
   * reads it. Two people clicking the same link — the visitor and a mail
   * scanner that prefetches links — must not both get a session, and
   * `used_at is null` in the UPDATE's WHERE is what guarantees only one
   * of them wins.
   */
  const result = await sql.begin(async (tx) => {
    const claimed = await tx<{ email: string }[]>`
      update login_tokens
         set used_at = now()
       where token_hash = ${hashToken(token)}
         and used_at is null
         and expires_at > now()
      returning email
    `
    if (!claimed[0]) return null
    const { email } = claimed[0]

    // First login creates the account. The name from the link is only
    // honoured here; on every later login the stored name wins.
    const users = await tx<{ id: string }[]>`
      insert into users (email, name)
      values (${email}, ${name || email.split('@')[0]!.slice(0, 40)})
      on conflict (email) do update set email = excluded.email
      returning id
    `
    const userId = users[0]!.id

    const session = newToken()
    await tx`
      insert into sessions (token_hash, user_id, expires_at)
      values (
        ${hashToken(session)},
        ${userId},
        now() + ${`${SESSION_TTL_DAYS} days`}::interval
      )
    `
    return { session }
  })

  if (!result) return back(event, 'eskirgan', '/kirish')

  setSessionCookie(event, result.session)

  // Expired and already-used links are the same answer on purpose: a
  // scanner that burned the link and the visitor who waited too long
  // both need to ask for a new one, and telling them apart tells an
  // attacker whether a guessed token ever existed.
  return back(event, 'ok', '/')
})
