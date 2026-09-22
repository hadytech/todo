import postgres from 'postgres'

/**
 * One Postgres handle per warm serverless instance.
 *
 * `max: 1` is the serverless rule: every instance is single-request, so a
 * pool larger than one only reserves connections nobody is using, and
 * Neon's free tier counts them. Neon's own pooler does the real pooling —
 * use the connection string with `-pooler` in the host.
 *
 * Nothing here is Neon-specific. `postgres` speaks to any Postgres, so
 * moving this to a VPS later is a change of DATABASE_URL and nothing
 * else.
 */
let handle: postgres.Sql | null = null

export function db(): postgres.Sql {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Sharhlar vaqtincha ishlamayapti',
    })
  }
  handle ??= postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Serverless cold starts pay for every prepared statement that is
    // never reused a second time.
    prepare: false,
  })
  return handle
}

/**
 * Whether the write side is configured at all.
 *
 * The site has to build and serve without a database — that is how it
 * stays deployable to plain static hosting, and how CI builds without
 * secrets. Endpoints check this and say so plainly instead of throwing a
 * connection error at the visitor.
 */
export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
