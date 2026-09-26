import { z } from 'zod'
import { db, dbConfigured } from '../../utils/db'
import { writerIdentity, cleanAuthorName } from '../../utils/identity'
import { requireSameOrigin } from '../../utils/sameorigin'
import { checkReviewRate } from '../../utils/ratelimit'
import { ipKey } from '../../utils/privacy'
import { catalog } from '../../utils/catalog'

const Body = z.object({
  slug: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  /**
   * A floor of 20 characters. "Zör!" is a rating, not a review, and the
   * star already carries it — the text is there to say something the
   * number cannot.
   */
  body: z.string().trim().min(20).max(4000),
  /**
   * What to sign it with, for someone who is not signed in. Optional:
   * a review signed "Mehmon" is still a review, and requiring a name is
   * a smaller version of requiring an account.
   */
  name: z.string().max(80).optional(),
})

/**
 * Write or rewrite this visitor's review of one place. No account needed.
 *
 * Upsert, not insert: one review per author per place, so a second opinion
 * replaces the first rather than stacking. That is the anti-astroturfing
 * rule and it lives in the database — a unique constraint for accounts,
 * a partial unique index for anonymous authors — so that no future
 * endpoint can forget it.
 *
 * The author is either a signed-in account or a random cookie the server
 * mints here on the first write. See server/utils/identity.ts for what
 * that cookie is, what it deliberately is not, and what it costs.
 */
export default defineEventHandler(async (event) => {
  if (!dbConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Şarhlar hozirça oçiq emas' })
  }
  requireSameOrigin(event)

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw createError({
      statusCode: 400,
      statusMessage: issue?.path[0] === 'body'
        ? 'Şarh kamida 20 ta belgidan iborat bölsin'
        : 'Şarhni tekşirib qayta yuboring',
    })
  }
  const { slug, rating, body } = parsed.data

  if (!catalog.businesses.some((b) => b.slug === slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Joy topilmadi' })
  }

  const me = await writerIdentity(event)
  const writerKey = ipKey(event)
  await checkReviewRate(me.user?.id ?? me.authorKey!, writerKey)

  // A signed-in review is signed with the account's name; the field is
  // ignored rather than rejected, because a client sending both is
  // confused, not hostile.
  const authorName = me.user ? null : cleanAuthorName(parsed.data.name)

  const sql = db()
  const [row] = me.user
    ? await sql<{ id: string; edited: boolean }[]>`
        insert into reviews (business_slug, user_id, rating, body, writer_key)
        values (${slug}, ${me.user.id}, ${rating}, ${body}, ${writerKey})
        on conflict (business_slug, user_id) do update
           set rating     = excluded.rating,
               body       = excluded.body,
               writer_key = excluded.writer_key,
               edited_at  = now(),
               -- A rewrite un-hides nothing: moderation stands until a
               -- human lifts it.
               hidden_at  = reviews.hidden_at
        returning id, (edited_at is not null) as edited
      `
    : await sql<{ id: string; edited: boolean }[]>`
        insert into reviews (business_slug, author_key, author_name, rating, body, writer_key)
        values (${slug}, ${me.authorKey}, ${authorName}, ${rating}, ${body}, ${writerKey})
        on conflict (business_slug, author_key) where author_key is not null do update
           set rating      = excluded.rating,
               body        = excluded.body,
               author_name = excluded.author_name,
               writer_key  = excluded.writer_key,
               edited_at   = now(),
               hidden_at   = reviews.hidden_at
        returning id, (edited_at is not null) as edited
      `

  return { ok: true, id: row!.id, edited: row!.edited }
})
