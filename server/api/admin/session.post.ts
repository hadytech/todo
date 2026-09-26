import { z } from 'zod'
import { adminConfigured, clearAdminCookie, setAdminCookie, tokenMatches } from '../../utils/admin'
import { requireSameOrigin } from '../../utils/sameorigin'

const Body = z.object({ token: z.string().max(200).optional() })

/**
 * Exchange the token for a cookie, or give the cookie back.
 *
 * Separate from the page so the token is posted rather than put in a URL
 * that ends up in history, and so signing out is one call rather than a
 * cookie the person has to find and delete.
 */
export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const parsed = Body.safeParse(await readBody(event).catch(() => ({})))
  const token = parsed.success ? parsed.data.token : undefined

  if (!token) {
    clearAdminCookie(event)
    return { ok: true, admin: false }
  }

  if (!adminConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'ADMIN_TOKEN sozlanmagan — tekşiruv sahifasi yopiq',
    })
  }
  if (!tokenMatches(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Kalit töğri kelmadi' })
  }

  setAdminCookie(event, token)
  return { ok: true, admin: true }
})
