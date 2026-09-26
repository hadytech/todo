import { db } from './db'
import { SCHEMA_DIGEST, SCHEMA_SQL } from './schema.generated'

/**
 * Apply the schema, once, the first time the write side is used.
 *
 * This exists so that connecting a database is the *whole* setup. The
 * alternative — telling somebody to run `npm run db:schema` after setting
 * an environment variable — needs a terminal, a Postgres client and a
 * connection string on a laptop, and it is a step that gets forgotten
 * exactly once and then looks like the code is broken. `psql -f
 * db/schema.sql` still works and is still the documented manual route;
 * this just means nobody has to take it.
 *
 * Three things make running DDL from a request handler safe here rather
 * than reckless:
 *
 *   - The schema is idempotent and tested as such, on a blank database, on
 *     an older one, and twice in a row (server/db.test.ts).
 *   - It runs under a Postgres advisory lock, so two cold starts arriving
 *     together cannot both apply it. The second waits, then sees the
 *     digest and does nothing.
 *   - It is memoised per instance and gated on a digest, so the steady
 *     state is one cheap single-row SELECT per cold start, not forty DDL
 *     statements per request.
 */

/**
 * Arbitrary but fixed: an advisory lock is just a number two callers have
 * to agree on. Derived from the first 8 hex digits of sha256('yalp-schema')
 * so it is unlikely to collide with anything else using this database.
 */
const LOCK_ID = 0x7a1_9c04

let inFlight: Promise<void> | null = null

/**
 * Resolves when the database's shape matches this build.
 *
 * Never rejects for a migration problem: a site that cannot migrate
 * should still serve, and the endpoint that needed the new column will
 * fail on its own with a real error. Swallowing it here and letting the
 * query speak is better than turning every read into a 500 because a
 * `create index` was refused.
 */
export function ensureSchema(): Promise<void> {
  inFlight ??= apply().catch((error) => {
    // Cleared, not kept: a failure caused by a transient connection error
    // should be retried by the next request rather than remembered for
    // the life of the instance.
    inFlight = null
    console.error('[migrate] schema qöllanmadi:', error instanceof Error ? error.message : error)
  })
  return inFlight
}

async function apply(): Promise<void> {
  const sql = db()

  if (await current(sql)) return

  // Serialise across instances. Without this, two cold starts can run
  // `create index if not exists` on the same index concurrently, which
  // Postgres answers with a duplicate-object error rather than a no-op.
  await sql`select pg_advisory_lock(${LOCK_ID})`
  try {
    // Re-check inside the lock: the instance that held it may have just
    // finished doing the work.
    if (await current(sql)) return
    await sql.unsafe(SCHEMA_SQL)
    await sql.unsafe(`
      create table if not exists schema_state (
        id         int primary key default 1 check (id = 1),
        digest     text not null,
        applied_at timestamptz not null default now()
      )
    `)
    await sql`
      insert into schema_state (id, digest) values (1, ${SCHEMA_DIGEST})
      on conflict (id) do update set digest = excluded.digest, applied_at = now()
    `
  } finally {
    await sql`select pg_advisory_unlock(${LOCK_ID})`
  }
}

/** True when this exact schema has already been applied. */
async function current(sql: ReturnType<typeof db>): Promise<boolean> {
  try {
    const [row] = await sql<{ digest: string }[]>`select digest from schema_state where id = 1`
    return row?.digest === SCHEMA_DIGEST
  } catch {
    // No schema_state table yet, which is the blank-database case and the
    // case where somebody applied the SQL by hand with psql. Either way
    // the answer is "apply it", and applying it to an up-to-date database
    // is a no-op that then records the digest.
    return false
  }
}
