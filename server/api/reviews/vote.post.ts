import { z } from 'zod'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/auth'

const Body = z.object({
  reviewId: z.string().uuid(),
  /** 1 up, -1 down, 0 to take the vote back. */
  value: z.number().int().min(-1).max(1),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Notöğri ovoz' })

  const { reviewId, value } = parsed.data
  const sql = db()

  // Voting on your own review is not moderation, it is just a thumb on
  // the scale — and it is the cheapest possible manipulation, so it is
  // refused rather than silently ignored.
  const [own] = await sql<{ mine: boolean }[]>`
    select (user_id = ${user.id}) as mine from reviews
     where id = ${reviewId} and hidden_at is null
  `
  if (!own) throw createError({ statusCode: 404, statusMessage: 'Sharh topilmadi' })
  if (own.mine) throw createError({ statusCode: 403, statusMessage: 'Öz sharhingizga ovoz bera olmaysiz' })

  if (value === 0) {
    await sql`delete from votes where review_id = ${reviewId} and user_id = ${user.id}`
  } else {
    await sql`
      insert into votes (review_id, user_id, value)
      values (${reviewId}, ${user.id}, ${value})
      on conflict (review_id, user_id) do update set value = excluded.value
    `
  }

  const [tally] = await sql<{ up: number; down: number }[]>`
    select coalesce(sum(case when value =  1 then 1 else 0 end), 0)::int as up,
           coalesce(sum(case when value = -1 then 1 else 0 end), 0)::int as down
      from votes where review_id = ${reviewId}
  `
  return { ok: true, ...tally!, myVote: value }
})
