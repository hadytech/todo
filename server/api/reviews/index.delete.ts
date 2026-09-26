import { z } from 'zod'
import { db, dbConfigured } from '../../utils/db'
import { readerIdentity } from '../../utils/identity'
import { requireSameOrigin } from '../../utils/sameorigin'

const Query = z.object({ slug: z.string().min(1).max(120) })

/**
 * Withdraw your own review. Votes on it go with it, by cascade.
 *
 * This is the delete side of "no account needed": whoever wrote it can
 * take it back, whether they were signed in or holding a cookie. There is
 * no reader identity to mint here — someone with no cookie has written
 * nothing to withdraw.
 */
export default defineEventHandler(async (event) => {
  if (!dbConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Şarhlar hozirça oçiq emas' })
  }
  requireSameOrigin(event)

  const parsed = Query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Slug kerak' })

  const me = await readerIdentity(event)
  if (!me) throw createError({ statusCode: 404, statusMessage: 'Şarh topilmadi' })

  // Scoped to the caller in the WHERE clause rather than checked first:
  // there is no window between the check and the delete, and no way for a
  // crafted slug to reach someone else's row.
  const deleted = await db()`
    delete from reviews
     where business_slug = ${parsed.data.slug}
       and (user_id = ${me.user?.id ?? null} or author_key = ${me.authorKey ?? null})
    returning id
  `
  if (deleted.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Şarh topilmadi' })
  }
  return { ok: true }
})
