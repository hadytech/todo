import { db } from '../../utils/db'
import { clearSessionCookie, hashToken, SESSION_COOKIE } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const raw = getCookie(event, SESSION_COOKIE)
  // The row goes, not just the cookie. A logout that only drops the
  // cookie leaves a working credential behind in anything that copied it.
  if (raw) await db()`delete from sessions where token_hash = ${hashToken(raw)}`
  clearSessionCookie(event)
  return { ok: true }
})
