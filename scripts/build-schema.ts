/**
 * Turns db/schema.sql into a TypeScript module.  `npm run schema`
 *
 * The server applies the schema itself on first use (server/utils/migrate.ts),
 * which means the SQL has to be inside the serverless bundle. A bundler
 * will not carry a .sql file it cannot see being imported, and
 * `readFileSync` at runtime looks for a path that does not exist in a
 * deployed function — so the file becomes a module at build time.
 *
 * db/schema.sql stays the thing a person edits and the thing `psql -f`
 * reads. This output is generated, and `schema.test.ts` fails if it has
 * drifted, so the two cannot disagree for longer than one CI run.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'db/schema.sql'
const OUT = 'server/utils/schema.generated.ts'

export function render(sql: string): string {
  const digest = createHash('sha256').update(sql).digest('hex')
  // A template literal, so the SQL stays readable in the output. Only
  // backticks, backslashes and ${ can end the literal early.
  const escaped = sql.replace(/[\\`]/g, '\\$&').replace(/\$\{/g, '\\${')
  return `/* eslint-disable */
/**
 * GENERATED FILE — do not edit.
 *
 * Produced from ${SOURCE} by scripts/build-schema.ts (\`npm run schema\`).
 * Edit the SQL there; server/utils/schema.test.ts fails if this drifts.
 */
export const SCHEMA_SQL = \`${escaped}\`

/** SHA-256 of the SQL above, used to skip a migration that already ran. */
export const SCHEMA_DIGEST = '${digest}'
`
}

if (process.argv[1]?.endsWith('build-schema.ts')) {
  const sql = readFileSync(SOURCE, 'utf8')
  writeFileSync(OUT, render(sql))
  console.log(`${OUT} — ${sql.length} bayt, ${createHash('sha256').update(sql).digest('hex').slice(0, 12)}`)
}
