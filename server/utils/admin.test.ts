import { afterEach, describe, expect, it } from 'vitest'
import { adminConfigured, normaliseToken, tokenMatches } from './admin'

const TOKEN = 'i6GYkSLALXxNMqxudH1rESwahR2o9njxCY5dB4i73ns'
const original = process.env.ADMIN_TOKEN
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_TOKEN
  else process.env.ADMIN_TOKEN = original
})

describe('normaliseToken', () => {
  it('drops surrounding whitespace', () => {
    // A long-press copy on a phone takes the newline with it.
    expect(normaliseToken(` ${TOKEN}\n`)).toBe(TOKEN)
    expect(normaliseToken(`\t${TOKEN}  `)).toBe(TOKEN)
  })

  it('drops the invisible characters a copy can carry', () => {
    expect(normaliseToken(` ${TOKEN}​`)).toBe(TOKEN)
    expect(normaliseToken(`﻿${TOKEN}`)).toBe(TOKEN)
  })

  it('changes nothing inside the token', () => {
    // Case, punctuation and length still matter. Normalising is about
    // transit damage, not about being lenient.
    expect(normaliseToken(TOKEN)).toBe(TOKEN)
    expect(normaliseToken(TOKEN.toLowerCase())).not.toBe(TOKEN)
    expect(normaliseToken(`${TOKEN}x`)).not.toBe(TOKEN)
  })
})

describe('tokenMatches', () => {
  it('accepts the token however it was pasted', () => {
    process.env.ADMIN_TOKEN = `${TOKEN}\n`
    expect(tokenMatches(TOKEN)).toBe(true)
    expect(tokenMatches(` ${TOKEN} `)).toBe(true)
  })

  it('still refuses a different token', () => {
    process.env.ADMIN_TOKEN = TOKEN
    expect(tokenMatches(`${TOKEN}x`)).toBe(false)
    expect(tokenMatches(TOKEN.slice(0, -1))).toBe(false)
    expect(tokenMatches(TOKEN.toUpperCase())).toBe(false)
  })

  it('refuses everything when nothing is configured', () => {
    // An absent secret must never mean an open door — including when the
    // variable exists but holds only whitespace.
    delete process.env.ADMIN_TOKEN
    expect(tokenMatches(TOKEN)).toBe(false)
    expect(tokenMatches('')).toBe(false)
    expect(adminConfigured()).toBe(false)

    process.env.ADMIN_TOKEN = '   \n'
    expect(adminConfigured()).toBe(false)
    expect(tokenMatches('')).toBe(false)
    expect(tokenMatches('   ')).toBe(false)
  })

  it('refuses an empty candidate against a real secret', () => {
    process.env.ADMIN_TOKEN = TOKEN
    expect(tokenMatches('')).toBe(false)
    expect(tokenMatches('\n ')).toBe(false)
  })
})
