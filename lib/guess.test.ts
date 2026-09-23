import { describe, it, expect } from 'vitest'
import { guessCategory } from './guess'

describe('guessCategory', () => {
  it('reads the category straight out of a typical Uzbek name', () => {
    expect(guessCategory('Çorsu Sartaroşxonasi')).toBe('gozallik/sartaroshxona')
    expect(guessCategory('Oloy Bozori')).toBe('savdo/bozor')
    expect(guessCategory('Shifo Dorixonasi')).toBe('sogliq/dorixona')
    expect(guessCategory('Toshkent Davlat Texnika Universiteti')).toBe('talim/universitet')
  })

  it('works whichever alphabet the name is written in', () => {
    // The whole point of folding to ASCII first: ç -> ch, ş -> sh, and
    // Cyrillic collapses to the same keys.
    for (const name of ['Çoyxona', 'Choyxona', 'Чойхона']) {
      expect(guessCategory(name)).toBe('ovqatlanish/choyxona')
    }
  })

  it('prefers the more specific keyword', () => {
    // "choyxona" contains no shorter rule that should beat it, and
    // "kompyuter doʻkoni" must not fall through to a generic "markaz".
    expect(guessCategory('Registon Çoyxonasi')).toBe('ovqatlanish/choyxona')
    expect(guessCategory('Malika Kompyuter Bozori')).toBe('savdo/kompyuter')
  })

  it('does not match a keyword buried inside another word', () => {
    // " lab " is padded in the rule precisely so "Kalabadan" cannot hit
    // the laboratory category.
    expect(guessCategory('Kalabadan')).not.toBe('sogliq/laboratoriya')
  })

  it('answers null rather than guessing plausibly', () => {
    // A wrong preselection is worse than none: someone skimming a filled
    // form tends to trust it.
    expect(guessCategory('Aziz va Farrux')).toBeNull()
    expect(guessCategory('')).toBeNull()
  })
})
