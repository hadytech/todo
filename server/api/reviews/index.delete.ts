import { z } from 'zod'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/auth'

const Query = z.object({ slug: z.string().min(1).max(120) })

/** Withdraw your own review. Votes on it go with it, by cascade. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const parsed = Query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Slug kerak' })

  // Scoped to the caller in the WHERE clause rather than checked first:
  // there is no window between the check and the delete, and no way for
  // a crafted id to reach someone else's row.
  const deleted = await db()`
    delete from reviews
     where business_slug = ${parsed.data.slug}
       and user_id = ${user.id}
    returning id
  `
  if (deleted.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Sharh topilmadi' })
  }
  return { ok: true }
})
