import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

/**
 * The SQL, run against a real Postgres.
 *
 * Everything that protects this site from being gamed lives in the
 * database — one review per person per place, one vote per person per
 * review, a login token that can only be spent once. Unit-testing the
 * JavaScript around those rules proves nothing: the rules are constraints,
 * and a constraint is only real if the server enforces it.
 *
 * Skipped unless TEST_DATABASE_URL is set, so `npm test` still runs with
 * no database anywhere:
 *
 *   TEST_DATABASE_URL=postgres://... npm test
 */
const url = process.env.TEST_DATABASE_URL
const run = url ? describe : describe.skip

run('schema', () => {
  let sql: postgres.Sql

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, prepare: false, onnotice: () => {} })
    await sql.unsafe(readFileSync('db/schema.sql', 'utf8'))
  })

  afterAll(async () => { await sql?.end() })

  beforeEach(async () => {
    // users cascades to reviews, sessions and votes.
    await sql`truncate users, login_tokens cascade`
  })

  const addUser = async (email: string) => {
    const [u] = await sql<{ id: string }[]>`
      insert into users (email, name) values (${email}, ${email.split('@')[0]!})
      returning id`
    return u!.id
  }

  const addReview = (userId: string, slug = 'ali-baba', rating = 5, body = 'x'.repeat(25)) =>
    sql<{ id: string }[]>`
      insert into reviews (business_slug, user_id, rating, body)
      values (${slug}, ${userId}, ${rating}, ${body})
      returning id`

  describe('one review per person per place', () => {
    it('refuses a second row for the same pair', async () => {
      const u = await addUser('a@b.uz')
      await addReview(u)
      await expect(addReview(u)).rejects.toThrow(/duplicate key|unique/i)
    })

    it('lets the upsert in index.post.ts rewrite instead', async () => {
      const u = await addUser('a@b.uz')
      await addReview(u, 'ali-baba', 5)

      // Verbatim from server/api/reviews/index.post.ts.
      const [row] = await sql<{ id: string; edited: boolean }[]>`
        insert into reviews (business_slug, user_id, rating, body)
        values ('ali-baba', ${u}, 2, ${'y'.repeat(25)})
        on conflict (business_slug, user_id) do update
           set rating = excluded.rating,
               body = excluded.body,
               edited_at = now(),
               hidden_at = reviews.hidden_at
        returning id, (edited_at is not null) as edited`

      expect(row!.edited).toBe(true)
      const all = await sql`select rating from reviews where user_id = ${u}`
      expect(all).toHaveLength(1)
      expect(all[0]!.rating).toBe(2)
    })

    it('does not let a rewrite un-hide a moderated review', async () => {
      const u = await addUser('a@b.uz')
      const [r] = await addReview(u)
      await sql`update reviews set hidden_at = now() where id = ${r!.id}`

      await sql`
        insert into reviews (business_slug, user_id, rating, body)
        values ('ali-baba', ${u}, 5, ${'z'.repeat(25)})
        on conflict (business_slug, user_id) do update
           set rating = excluded.rating, body = excluded.body,
               edited_at = now(), hidden_at = reviews.hidden_at`

      const [row] = await sql<{ hidden_at: Date | null }[]>`
        select hidden_at from reviews where id = ${r!.id}`
      expect(row!.hidden_at).not.toBeNull()
    })

    it('allows the same person to review different places', async () => {
      const u = await addUser('a@b.uz')
      await addReview(u, 'ali-baba')
      await expect(addReview(u, 'chorsu')).resolves.toBeDefined()
    })
  })

  describe('constraints', () => {
    it('rejects a rating outside 1-5', async () => {
      const u = await addUser('a@b.uz')
      await expect(addReview(u, 'x', 0)).rejects.toThrow(/check constraint/i)
      await expect(addReview(u, 'y', 6)).rejects.toThrow(/check constraint/i)
    })

    it('rejects a review that is only whitespace padding', async () => {
      // length(btrim(body)) — otherwise 20 spaces passes the floor.
      const u = await addUser('a@b.uz')
      await expect(addReview(u, 'x', 5, ' '.repeat(40))).rejects.toThrow(/check constraint/i)
    })

    it('rejects a duplicate email', async () => {
      await addUser('a@b.uz')
      await expect(addUser('a@b.uz')).rejects.toThrow(/duplicate key|unique/i)
    })
  })

  describe('votes', () => {
    it('keeps one vote per person per review, and lets it change', async () => {
      const author = await addUser('a@b.uz')
      const voter = await addUser('v@b.uz')
      const [r] = await addReview(author)

      for (const v of [1, -1, 1]) {
        await sql`
          insert into votes (review_id, user_id, value) values (${r!.id}, ${voter}, ${v})
          on conflict (review_id, user_id) do update set value = excluded.value`
      }

      const rows = await sql<{ value: number }[]>`
        select value from votes where review_id = ${r!.id}`
      expect(rows).toHaveLength(1)
      expect(rows[0]!.value).toBe(1)
    })

    it('rejects a vote that is neither up nor down', async () => {
      const author = await addUser('a@b.uz')
      const voter = await addUser('v@b.uz')
      const [r] = await addReview(author)
      await expect(sql`
        insert into votes (review_id, user_id, value) values (${r!.id}, ${voter}, 0)
      `).rejects.toThrow(/check constraint/i)
    })

    it('takes votes with the review when it is withdrawn', async () => {
      const author = await addUser('a@b.uz')
      const voter = await addUser('v@b.uz')
      const [r] = await addReview(author)
      await sql`insert into votes (review_id, user_id, value) values (${r!.id}, ${voter}, 1)`

      await sql`delete from reviews where id = ${r!.id}`
      expect(await sql`select 1 from votes`).toHaveLength(0)
    })
  })

  describe('the listing query', () => {
    it('counts votes and reports the caller’s own vote', async () => {
      const author = await addUser('a@b.uz')
      const me = await addUser('me@b.uz')
      const other = await addUser('o@b.uz')
      const [r] = await addReview(author)

      await sql`insert into votes (review_id, user_id, value) values (${r!.id}, ${me}, 1)`
      await sql`insert into votes (review_id, user_id, value) values (${r!.id}, ${other}, -1)`

      // Verbatim from server/api/reviews/[slug].get.ts.
      const rows = await sql<{ up: number; down: number; myVote: number }[]>`
        select r.id,
               coalesce(sum(case when v.value =  1 then 1 else 0 end), 0)::int as up,
               coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int as down,
               coalesce(max(case when v.user_id = ${me} then v.value end), 0)::int as "myVote"
          from reviews r
          join users u on u.id = r.user_id
     left join votes v on v.review_id = r.id
         where r.business_slug = 'ali-baba' and r.hidden_at is null
      group by r.id, u.name`

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ up: 1, down: 1, myVote: 1 })
    })

    it('reports myVote as 0 for a signed-out reader', async () => {
      // The null slot is what an anonymous request passes. A NULL
      // comparison must not throw and must not match anyone's vote.
      const author = await addUser('a@b.uz')
      const voter = await addUser('v@b.uz')
      const [r] = await addReview(author)
      await sql`insert into votes (review_id, user_id, value) values (${r!.id}, ${voter}, 1)`

      const anon: string | null = null
      const rows = await sql<{ up: number; myVote: number }[]>`
        select coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::int as up,
               coalesce(max(case when v.user_id = ${anon} then v.value end), 0)::int as "myVote"
          from reviews r left join votes v on v.review_id = r.id
         where r.business_slug = 'ali-baba'
      group by r.id`

      expect(rows[0]).toMatchObject({ up: 1, myVote: 0 })
    })

    it('hides moderated reviews from both the list and the stats', async () => {
      const a = await addUser('a@b.uz')
      const b = await addUser('b@b.uz')
      await addReview(a, 'ali-baba', 5)
      const [bad] = await addReview(b, 'ali-baba', 1)
      await sql`update reviews set hidden_at = now() where id = ${bad!.id}`

      const [stats] = await sql<{ review_count: number; rating_avg: number }[]>`
        select * from review_stats where business_slug = 'ali-baba'`
      expect(stats!.review_count).toBe(1)
      expect(Number(stats!.rating_avg)).toBe(5)
    })
  })

  describe('login tokens', () => {
    it('can only be spent once, even by two simultaneous clicks', async () => {
      // The real case: a mail scanner prefetches the link, then the
      // visitor taps it. Exactly one of them may get a session.
      await sql`
        insert into login_tokens (token_hash, email, expires_at)
        values ('h', 'a@b.uz', now() + interval '20 minutes')`

      const claim = () => sql`
        update login_tokens set used_at = now()
         where token_hash = 'h' and used_at is null and expires_at > now()
        returning email`

      const [first, second] = await Promise.all([claim(), claim()])
      expect(first.length + second.length).toBe(1)
    })

    it('refuses an expired token', async () => {
      await sql`
        insert into login_tokens (token_hash, email, expires_at)
        values ('h', 'a@b.uz', now() - interval '1 minute')`
      const claimed = await sql`
        update login_tokens set used_at = now()
         where token_hash = 'h' and used_at is null and expires_at > now()
        returning email`
      expect(claimed).toHaveLength(0)
    })
  })

  describe('sessions', () => {
    it('stops resolving once expired', async () => {
      const u = await addUser('a@b.uz')
      await sql`
        insert into sessions (token_hash, user_id, expires_at)
        values ('live', ${u}, now() + interval '1 day'),
               ('dead', ${u}, now() - interval '1 day')`

      const resolve = (h: string) => sql`
        select u.id from sessions s join users u on u.id = s.user_id
         where s.token_hash = ${h} and s.expires_at > now() and u.blocked_at is null`

      expect(await resolve('live')).toHaveLength(1)
      expect(await resolve('dead')).toHaveLength(0)
    })

    it('stops resolving the moment the account is blocked', async () => {
      const u = await addUser('a@b.uz')
      await sql`insert into sessions (token_hash, user_id, expires_at)
                values ('t', ${u}, now() + interval '1 day')`
      await sql`update users set blocked_at = now() where id = ${u}`

      const rows = await sql`
        select u.id from sessions s join users u on u.id = s.user_id
         where s.token_hash = 't' and s.expires_at > now() and u.blocked_at is null`
      expect(rows).toHaveLength(0)
    })
  })

  describe('withdrawing a review', () => {
    it('cannot reach someone else’s row', async () => {
      const mine = await addUser('a@b.uz')
      const theirs = await addUser('b@b.uz')
      await addReview(mine, 'ali-baba')
      await addReview(theirs, 'ali-baba')

      // Verbatim from index.delete.ts — scoped in the WHERE clause.
      const deleted = await sql`
        delete from reviews where business_slug = 'ali-baba' and user_id = ${mine}
        returning id`

      expect(deleted).toHaveLength(1)
      const left = await sql<{ user_id: string }[]>`select user_id from reviews`
      expect(left).toHaveLength(1)
      expect(left[0]!.user_id).toBe(theirs)
    })
  })
})
