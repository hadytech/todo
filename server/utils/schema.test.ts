import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { render } from '../../scripts/build-schema'
import { SCHEMA_DIGEST, SCHEMA_SQL } from './schema.generated'

/**
 * The generated copy of the schema has to match the SQL file.
 *
 * Same guard as lib/brand.test.ts uses between the stylesheet and the
 * brand definition: the only reliable way to keep a generated file honest
 * is a test that regenerates it and compares. Without this, editing
 * db/schema.sql and forgetting `npm run schema` would deploy a server
 * that migrates to yesterday's shape — and it would do it silently,
 * because the SQL is idempotent and would not complain.
 */
describe('generated schema', () => {
  const source = readFileSync('db/schema.sql', 'utf8')

  it('is up to date with db/schema.sql', () => {
    expect(render(source)).toBe(readFileSync('server/utils/schema.generated.ts', 'utf8'))
  })

  it('round-trips the SQL exactly, escaping and all', () => {
    // The SQL contains backslashes (the information_schema LIKE patterns)
    // and dollar-quoted do-blocks. Both can end a template literal early.
    expect(SCHEMA_SQL).toBe(source)
    expect(SCHEMA_SQL).toContain('$$')
    expect(SCHEMA_SQL).toContain('create table if not exists reviews')
  })

  it('carries a digest of what it holds', () => {
    expect(SCHEMA_DIGEST).toBe(createHash('sha256').update(source).digest('hex'))
    expect(SCHEMA_DIGEST).toMatch(/^[0-9a-f]{64}$/)
  })
})
