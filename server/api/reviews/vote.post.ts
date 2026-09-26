import { z } from 'zod'
import { db, dbConfigured } from '../../utils/db'
import { writerIdentity } from '../../utils/identity'
import { requireSameOrigin } from '../../utils/sameorigin'

const Body = z.object({
  reviewId: z.string().uuid(),
  /** 1 up, -1 down, 0 to take the vote back. */
  value: z.number().int().min(-1).max(1),
})

/**
 * Mark a review useful or not. No account needed.
 *
 * One vote per author per review, enforced by the primary key on
 * (review_id, voter) rather than by this handler.
 */
export default defineEventHandler(async (event) => {
  if (!dbConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Şarhlar hozirça oçiq emas' })
  }
  requireSameOrigin(event)

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Notöğri ovoz' })

  const { reviewId, value } = parsed.data
  const me = await writerIdentity(event)
  const sql = db()

  // Voting on your own review is not moderation, it is just a thumb on
  // the scale — and it is the cheapest possible manipulation, so it is
  // refused rather than silently ignored.
  const [row] = await sql<{ mine: boolean }[]>`
    select (user_id = ${me.user?.id ?? null} or author_key = ${me.authorKey ?? null}) as mine
      from reviews
     where id = ${reviewId} and hidden_at is null
  `
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Şarh topilmadi' })
  if (row.mine) {
    throw createError({ statusCode: 403, statusMessage: 'Öz şarhingizga ovoz bera olmaysiz' })
  }

  if (value === 0) {
    await sql`delete from votes where review_id = ${reviewId} and voter = ${me.voter}`
  } else {
    await sql`
      insert into votes (review_id, voter, value)
      values (${reviewId}, ${me.voter}, ${value})
      on conflict (review_id, voter) do update set value = excluded.value
    `
  }

  const [tally] = await sql<{ up: number; down: number }[]>`
    select coalesce(sum(case when value =  1 then 1 else 0 end), 0)::int as up,
           coalesce(sum(case when value = -1 then 1 else 0 end), 0)::int as down
      from votes where review_id = ${reviewId}
  `
  return { ok: true, ...tally!, myVote: value }
})
