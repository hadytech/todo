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
    // reviews explicitly: users cascades to reviews written by an
    // account, but an anonymous review has no user row to cascade from —
    // which is the point of it, and would otherwise leave rows behind
    // between tests.
    await sql`truncate users, login_tokens, reviews cascade`
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

  /** A review written with no account — a cookie key and nothing else. */
  const addGuest = (
    key: string,
    slug = 'ali-baba',
    rating = 5,
    name: string | null = null,
    body = 'g'.repeat(25),
  ) =>
    sql<{ id: string }[]>`
      insert into reviews (business_slug, author_key, author_name, rating, body)
      values (${slug}, ${key}, ${name}, ${rating}, ${body})
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
          insert into votes (review_id, voter, value) values (${r!.id}, ${`u:${voter}`}, ${v})
          on conflict (review_id, voter) do update set value = excluded.value`
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
        insert into votes (review_id, voter, value) values (${r!.id}, ${`u:${voter}`}, 0)
      `).rejects.toThrow(/check constraint/i)
    })

    it('takes votes with the review when it is withdrawn', async () => {
      const author = await addUser('a@b.uz')
      const voter = await addUser('v@b.uz')
      const [r] = await addReview(author)
      await sql`insert into votes (review_id, voter, value) values (${r!.id}, ${`u:${voter}`}, 1)`

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

      await sql`insert into votes (review_id, voter, value) values (${r!.id}, ${`u:${me}`}, 1)`
      await sql`insert into votes (review_id, voter, value) values (${r!.id}, ${'a:guest'}, -1)`

      // Verbatim from server/api/reviews/[slug].get.ts.
      const rows = await sql<{ up: number; down: number; myVote: number }[]>`
        select r.id,
               coalesce(sum(case when v.value =  1 then 1 else 0 end), 0)::int as up,
               coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int as down,
               coalesce(max(case when v.voter = ${`u:${me}`} then v.value end), 0)::int as "myVote"
          from reviews r
     left join users u on u.id = r.user_id
     left join votes v on v.review_id = r.id
         where r.business_slug = 'ali-baba' and r.hidden_at is null
           and (u.id is null or u.blocked_at is null)
      group by r.id, u.name, u.id`

      expect(rows).toHaveLength(1)
      // An account and a guest, counted the same. That is the whole
      // change: a vote is a vote whoever cast it.
      expect(rows[0]).toMatchObject({ up: 1, down: 1, myVote: 1 })
    })

    it('reports myVote as 0 for a signed-out reader', async () => {
      // The null slot is what an anonymous request passes. A NULL
      // comparison must not throw and must not match anyone's vote.
      const author = await addUser('a@b.uz')
      const voter = await addUser('v@b.uz')
      const [r] = await addReview(author)
      await sql`insert into votes (review_id, voter, value) values (${r!.id}, ${`u:${voter}`}, 1)`

      const anon: string | null = null
      const rows = await sql<{ up: number; myVote: number }[]>`
        select coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::int as up,
               coalesce(max(case when v.voter = ${anon} then v.value end), 0)::int as "myVote"
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

  describe('writing without an account', () => {
    it('keeps one review per anonymous author per place', async () => {
      // The same rule accounts have always had, enforced by a partial
      // unique index because the column is nullable.
      await addGuest('key-one')
      await expect(addGuest('key-one')).rejects.toThrow(/duplicate key|unique/i)
    })

    it('lets two different guests review the same place', async () => {
      await addGuest('key-one')
      await expect(addGuest('key-two')).resolves.toBeDefined()
    })

    it('lets one guest review two places', async () => {
      await addGuest('key-one', 'ali-baba')
      await expect(addGuest('key-one', 'chorsu')).resolves.toBeDefined()
    })

    it('rewrites rather than stacking, through the endpoint’s upsert', async () => {
      await addGuest('key-one', 'ali-baba', 5, 'Ali')

      // Verbatim from server/api/reviews/index.post.ts.
      const [row] = await sql<{ edited: boolean }[]>`
        insert into reviews (business_slug, author_key, author_name, rating, body, writer_key)
        values ('ali-baba', 'key-one', 'Ali', 2, ${'z'.repeat(25)}, 'today')
        on conflict (business_slug, author_key) where author_key is not null do update
           set rating      = excluded.rating,
               body        = excluded.body,
               author_name = excluded.author_name,
               writer_key  = excluded.writer_key,
               edited_at   = now(),
               hidden_at   = reviews.hidden_at
        returning (edited_at is not null) as edited`

      expect(row!.edited).toBe(true)
      const all = await sql<{ rating: number }[]>`select rating from reviews`
      expect(all).toHaveLength(1)
      expect(all[0]!.rating).toBe(2)
    })

    it('refuses a review with no author and one with two', async () => {
      // An unattributed review is one both uniqueness rules are blind to,
      // so it must not be representable at all.
      const u = await addUser('a@b.uz')
      await expect(sql`
        insert into reviews (business_slug, rating, body)
        values ('ali-baba', 5, ${'x'.repeat(25)})
      `).rejects.toThrow(/reviews_one_author|check constraint/i)
      await expect(sql`
        insert into reviews (business_slug, user_id, author_key, rating, body)
        values ('ali-baba', ${u}, 'key-one', 5, ${'x'.repeat(25)})
      `).rejects.toThrow(/reviews_one_author|check constraint/i)
    })

    it('survives the author’s account being deleted, because there is none', async () => {
      const u = await addUser('a@b.uz')
      await addReview(u, 'ali-baba')
      await addGuest('key-one', 'ali-baba')

      await sql`delete from users where id = ${u}`

      // The account's review cascaded away; the guest's did not. A guest
      // review is not owned by anybody the database can delete.
      const left = await sql<{ author_key: string | null }[]>`select author_key from reviews`
      expect(left).toHaveLength(1)
      expect(left[0]!.author_key).toBe('key-one')
    })

    it('shows a guest’s typed name, and a generic one when there is none', async () => {
      await addGuest('key-one', 'ali-baba', 5, 'Ali')
      await addGuest('key-two', 'ali-baba', 4, null)
      const u = await addUser('signed@b.uz')
      await addReview(u, 'ali-baba')

      // Verbatim from the listing query.
      const rows = await sql<{ authorName: string; guest: boolean }[]>`
        select coalesce(u.name, r.author_name, 'Mehmon') as "authorName",
               (r.user_id is null) as "guest"
          from reviews r
     left join users u on u.id = r.user_id
         where r.business_slug = 'ali-baba'
      order by 1`

      expect(rows.map((r) => [r.authorName, r.guest])).toEqual([
        ['Ali', true],
        ['Mehmon', true],
        ['signed', false],
      ])
    })

    it('lets a guest delete their own review and nobody else’s', async () => {
      await addGuest('key-mine', 'ali-baba')
      await addGuest('key-theirs', 'ali-baba')

      // Verbatim from index.delete.ts, on the anonymous side.
      const userId: string | null = null
      const deleted = await sql`
        delete from reviews
         where business_slug = 'ali-baba'
           and (user_id = ${userId} or author_key = 'key-mine')
        returning id`

      expect(deleted).toHaveLength(1)
      const left = await sql<{ author_key: string }[]>`select author_key from reviews`
      expect(left).toHaveLength(1)
      expect(left[0]!.author_key).toBe('key-theirs')
    })

    it('does not let a guest vote on their own review', async () => {
      const [r] = await addGuest('key-one')

      // Verbatim from vote.post.ts. SQL's three-valued logic is the
      // subtlety: user_id = null is NULL, not false, so the `or` has to
      // be relied on rather than reasoned around.
      const userId: string | null = null
      const [own] = await sql<{ mine: boolean | null }[]>`
        select (user_id = ${userId} or author_key = 'key-one') as mine
          from reviews where id = ${r!.id} and hidden_at is null`
      expect(own!.mine).toBe(true)

      const [other] = await sql<{ mine: boolean | null }[]>`
        select (user_id = ${userId} or author_key = 'key-two') as mine
          from reviews where id = ${r!.id} and hidden_at is null`
      // NULL or false is NULL, which the handler treats as "not mine".
      expect(other!.mine === true).toBe(false)
    })

    it('hides a blocked account’s reviews without touching guests', async () => {
      const u = await addUser('spam@b.uz')
      await addReview(u, 'ali-baba')
      await addGuest('key-one', 'ali-baba')
      await sql`update users set blocked_at = now() where id = ${u}`

      const rows = await sql`
        select r.id from reviews r
     left join users u on u.id = r.user_id
         where r.business_slug = 'ali-baba' and r.hidden_at is null
           and (u.id is null or u.blocked_at is null)`
      expect(rows).toHaveLength(1)
    })
  })

  describe('addresses are not stored', () => {
    it('has no column that could hold one', async () => {
      // The privacy claim, asserted against the live schema rather than
      // trusted to a comment: if someone re-adds an IP column, this fails.
      const rows = await sql<{ table_name: string; column_name: string }[]>`
        select table_name, column_name
          from information_schema.columns
         where table_schema = current_schema()
           and (column_name like '%\\_ip' or column_name like 'ip\\_%' or column_name = 'ip')`
      expect(rows).toEqual([])
    })

    it('keeps the throttling columns it replaced them with', async () => {
      const rows = await sql<{ column_name: string }[]>`
        select column_name from information_schema.columns
         where table_schema = current_schema()
           and column_name in ('submitter_key', 'request_key', 'writer_key')
      order by column_name`
      expect(rows.map((r) => r.column_name))
        .toEqual(['request_key', 'submitter_key', 'writer_key'])
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
      const anonKey: string | null = null
      const deleted = await sql`
        delete from reviews
         where business_slug = 'ali-baba'
           and (user_id = ${mine} or author_key = ${anonKey})
        returning id`

      expect(deleted).toHaveLength(1)
      const left = await sql<{ user_id: string }[]>`select user_id from reviews`
      expect(left).toHaveLength(1)
      expect(left[0]!.user_id).toBe(theirs)
    })
  })
})
