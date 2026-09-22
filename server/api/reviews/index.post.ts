import { z } from 'zod'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { checkReviewRate } from '../../utils/ratelimit'
import { catalog } from '../../utils/catalog'

const Body = z.object({
  slug: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  /**
   * A floor of 20 characters. "Zoʻr!" is a rating, not a review, and the
   * star already carries it — the text is there to say something the
   * number cannot.
   */
  body: z.string().trim().min(20).max(4000),
})

/**
 * Write or rewrite this visitor's review of one place.
 *
 * Upsert, not insert: the unique constraint on (business_slug, user_id)
 * means a second opinion replaces the first rather than stacking. That is
 * the anti-astroturfing rule, and having the database enforce it means no
 * future endpoint can forget it.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw createError({
      statusCode: 400,
      statusMessage: issue?.path[0] === 'body'
        ? 'Sharh kamida 20 ta belgidan iborat boʻlsin'
        : 'Sharhni tekşirib qayta yuboring',
    })
  }
  const { slug, rating, body } = parsed.data

  if (!catalog.businesses.some((b) => b.slug === slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Joy topilmadi' })
  }

  await checkReviewRate(user.id)

  const [row] = await db()<{ id: string; edited: boolean }[]>`
    insert into reviews (business_slug, user_id, rating, body)
    values (${slug}, ${user.id}, ${rating}, ${body})
    on conflict (business_slug, user_id) do update
       set rating    = excluded.rating,
           body      = excluded.body,
           edited_at = now(),
           -- A rewrite un-hides nothing: moderation stands until a human
           -- lifts it.
           hidden_at = reviews.hidden_at
    returning id, (edited_at is not null) as edited
  `

  return { ok: true, id: row!.id, edited: row!.edited }
})
