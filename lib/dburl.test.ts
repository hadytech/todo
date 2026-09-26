import { describe, expect, it } from 'vitest'
import { DB_URL_VARS, databaseUrl } from './dburl'
import { ipSecret } from './privacy'

describe('databaseUrl', () => {
  it('prefers the pooled name this project documents', () => {
    expect(databaseUrl({
      DATABASE_URL: 'postgres://pooled',
      POSTGRES_URL: 'postgres://vercel',
      DATABASE_URL_UNPOOLED: 'postgres://direct',
    })).toBe('postgres://pooled')
  })

  it('accepts what Vercel Postgres sets', () => {
    expect(databaseUrl({ POSTGRES_URL: 'postgres://vercel' })).toBe('postgres://vercel')
  })

  it('falls back to the unpooled URL last', () => {
    // It works, and it is better than reporting "no database" to somebody
    // who has in fact connected one.
    expect(databaseUrl({ DATABASE_URL_UNPOOLED: 'postgres://direct' })).toBe('postgres://direct')
  })

  it('treats blank and whitespace as absent', () => {
    // A variable set to "" in a dashboard is the same as not set, and the
    // difference decides whether the site offers a form or a clipboard.
    expect(databaseUrl({ DATABASE_URL: '', POSTGRES_URL: '  ' })).toBeUndefined()
    expect(databaseUrl({})).toBeUndefined()
  })

  it('trims, so a pasted value with a stray newline still connects', () => {
    expect(databaseUrl({ DATABASE_URL: ' postgres://x\n' })).toBe('postgres://x')
  })

  it('names every variable it reads', () => {
    expect([...DB_URL_VARS]).toEqual(['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL_UNPOOLED'])
  })
})

describe('the pseudonym key follows the same resolution', () => {
  it('derives from whichever variable supplied the connection', () => {
    // If these two disagreed, renaming a variable would silently rotate
    // every pseudonym and reset every rate limit.
    expect(ipSecret({ POSTGRES_URL: 'postgres://x' }))
      .toBe(ipSecret({ DATABASE_URL: 'postgres://x' }))
  })

  it('still lets IP_SALT override', () => {
    expect(ipSecret({ IP_SALT: 'own', POSTGRES_URL: 'postgres://x' }))
      .not.toBe(ipSecret({ POSTGRES_URL: 'postgres://x' }))
  })
})
