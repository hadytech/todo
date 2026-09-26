/**
 * Where the connection string comes from.
 *
 * `DATABASE_URL` is the name this project asks for, but the easiest way to
 * get a free Postgres onto a Vercel project is Vercel's own Storage tab,
 * and the integrations there set their own names: Neon writes
 * `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, Vercel Postgres writes
 * `POSTGRES_URL`. Accepting all three costs one list and removes a
 * failure that would look exactly like "the database is not connected"
 * while the database was in fact connected.
 *
 * Order matters: the pooled URL first, because a serverless function
 * should talk to the pooler and not hold a real connection per instance.
 * The unpooled one is last — it works, and it is better than nothing.
 */
export const DB_URL_VARS = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL_UNPOOLED'] as const

export function databaseUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  for (const name of DB_URL_VARS) {
    const value = env[name]?.trim()
    if (value) return value
  }
  return undefined
}
