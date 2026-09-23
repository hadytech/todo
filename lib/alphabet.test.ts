import { describe, it, expect } from 'vitest'
import {
  toDisplay, toStandardLatin, toAscii, toSlug, toSearchKey, findLegacySpellings,
  toCanonical, findOfficialSpellings,
} from './alphabet'

/**
 * Every row is one real name written every way a user might type it.
 * They must all collapse to a single search key, or search fails for
 * whichever group of users writes it the "wrong" way.
 */
const EQUIVALENTS: Array<{ key: string; spellings: string[] }> = [
  { key: 'chorsu',      spellings: ['Çorsu', 'Chorsu', 'chorsu', 'Чорсу', 'ЧОРСУ'] },
  { key: 'toshkent',    spellings: ['Toşkent', 'Toshkent', 'toshkent', 'Тошкент'] },
  { key: 'gozallik',    spellings: ['Gözallik', 'Goʻzallik', "Go'zallik", 'Gozallik', 'Гўзаллик'] },
  { key: 'ozbekiston',  spellings: ['Özbekiston', 'Oʻzbekiston', "O'zbekiston", 'Ўзбекистон'] },
  { key: 'sogliq',      spellings: ['Soğliq', 'Sogʻliq', "Sog'liq", 'Соғлиқ'] },
  { key: 'sartaroshxona', spellings: ['Sartaroşxona', 'Sartaroshxona', 'Сартарошхона'] },
  { key: 'yunusobod',   spellings: ['Yunusobod', 'Юнусобод'] },
]

describe('toSearchKey — cross-alphabet folding', () => {
  for (const { key, spellings } of EQUIVALENTS) {
    it(`folds every spelling of "${key}"`, () => {
      for (const s of spellings) expect(toSearchKey(s)).toBe(key)
    })
  }

  it('is idempotent, so a pre-normalized query is safe to re-normalize', () => {
    for (const { spellings } of EQUIVALENTS) {
      for (const s of spellings) {
        const once = toSearchKey(s)
        expect(toSearchKey(once)).toBe(once)
      }
    }
  })

  it('strips punctuation and collapses whitespace', () => {
    expect(toSearchKey('  Çorsu   Restorani!  ')).toBe('chorsu restorani')
    expect(toSearchKey('Kafe "Navröz" \u2014 \u21161')).toBe('kafe navroz 1')
  })

  it('folds Cyrillic \u04e9, a common mistype for \u045e on non-Uzbek layouts', () => {
    // Uzbek Cyrillic uses \u045e, not \u04e9 \u2014 but neighbouring-language keyboards
    // produce \u04e9, and an unmapped Cyrillic letter would silently become a
    // space and corrupt the key rather than degrade.
    expect(toSearchKey('Navr\u04e9z')).toBe('navroz')
  })

  it('returns empty for empty or punctuation-only input', () => {
    expect(toSearchKey('')).toBe('')
    expect(toSearchKey('!!! ???')).toBe('')
  })

  it('treats c+h identically in index and query, so matching never breaks', () => {
    // "ch" is always a digraph in Uzbek. Loanwords are folded the same way
    // on both sides, so the fold is lossy but symmetric — which is all
    // matching requires.
    expect(toSearchKey('Fresh Line')).toBe(toSearchKey('Freş Line'))
  })
})

describe('toAscii — the SEO-critical digraph expansion', () => {
  // This is the entire reason the site can rank for "chorsu". A generic
  // diacritic fold gives ç->c, which would lose the query everyone types.
  it('expands ç to "ch", not "c"', () => {
    expect(toAscii('Çorsu')).toBe('Chorsu')
    expect(toAscii('Çorsu')).not.toBe('Corsu')
  })

  it('expands ş to "sh", not "s"', () => {
    expect(toAscii('Toşkent')).toBe('Toshkent')
    expect(toAscii('Toşkent')).not.toBe('Toskent')
  })

  it('title-cases multi-char replacements instead of shouting', () => {
    expect(toAscii('Çorsu')).toBe('Chorsu')
    expect(toAscii('Çorsu')).not.toBe('CHorsu')
  })

  it('maps ö and ğ to bare o and g, dropping the okina', () => {
    expect(toAscii('Gözallik')).toBe('Gozallik')
    expect(toAscii('Soğliq')).toBe('Sogliq')
  })
})

describe('toStandardLatin — official orthography for alternateName', () => {
  it('uses the okina U+02BB', () => {
    expect(toStandardLatin('Özbekiston')).toBe('Oʻzbekiston')
    expect(toStandardLatin('Soğliq')).toBe('Sogʻliq')
  })

  it('expands ç and ş to digraphs', () => {
    expect(toStandardLatin('Çorsu')).toBe('Chorsu')
    expect(toStandardLatin('Toşkent')).toBe('Toshkent')
  })

  it('leaves text without new-alphabet letters untouched', () => {
    expect(toStandardLatin('Yunusobod')).toBe('Yunusobod')
  })
})

describe('toSlug', () => {
  it('produces ASCII URL slugs that carry the searchable spelling', () => {
    expect(toSlug('Çorsu Restorani')).toBe('chorsu-restorani')
    expect(toSlug('Gözallik Saloni "Nilufar"')).toBe('gozallik-saloni-nilufar')
  })

  it('has no leading, trailing or doubled hyphens', () => {
    expect(toSlug('  —Kafe—  ')).toBe('kafe')
  })
})

describe('toDisplay', () => {
  it('preserves the new alphabet exactly as authored', () => {
    expect(toDisplay('Çorsu Restorani')).toBe('Çorsu Restorani')
  })

  it('normalizes to NFC so composed and decomposed forms compare equal', () => {
    expect(toDisplay('ö')).toBe('ö')
  })
})

describe('findLegacySpellings', () => {
  it('flags data authored in the old alphabet', () => {
    expect(findLegacySpellings("Cho'rsu")).toContain("o'")
    expect(findLegacySpellings('Toshkent')).toContain('sh')
  })

  it('stays quiet on correctly authored data', () => {
    expect(findLegacySpellings('Çorsu Restorani')).toEqual([])
  })
})

describe('toCanonical', () => {
  it('folds the official digraphs into the new letters', () => {
    expect(toCanonical('koʻchasi')).toBe('köchasi')
    expect(toCanonical('yongʻoq')).toBe('yonğoq')
    expect(toCanonical('Oʻzbekiston')).toBe('Özbekiston')
  })

  it('fixes the half-converted spelling this project kept producing', () => {
    // ç and ş were applied while oʻ was left alone, which is neither
    // alphabet. This is the exact string that shipped in the data.
    expect(toCanonical('koʻçasi')).toBe('köçasi')
    expect(toCanonical('notoʻğri')).toBe('notöğri')
  })

  it('accepts whichever apostrophe someone actually typed, when asked', () => {
    for (const q of ['ʻ', '‘', '’', 'ʼ', '`', "'"]) {
      expect(toCanonical(`qo${q}shish`, { typed: true })).toBe('qöshish')
    }
  })

  it('leaves code punctuation alone by default', () => {
    // The trap this restriction exists for: `from './lib/rating'` ends
    // in g-then-quote. Folding that would rewrite the import to
    // `'./lib/ratingğ` and take the build down.
    expect(toCanonical("import { bayesian } from './lib/rating'"))
      .toBe("import { bayesian } from './lib/rating'")
    expect(toCanonical('const catalog = `x`')).toBe('const catalog = `x`')
  })

  it('preserves case, including on the capital form', () => {
    expect(toCanonical('OʻZBEKISTON')).toBe('ÖZBEKISTON')
    expect(toCanonical('Toʻldirish')).toBe('Töldirish')
  })

  it('leaves ch and sh alone, on purpose', () => {
    // These are ambiguous with foreign words, and a directory that
    // renames the institutions it lists is worse than one with
    // inconsistent spelling. They stay a human's judgement.
    expect(toCanonical('Westminster')).toBe('Westminster')
    expect(toCanonical('MDIS Tashkent')).toBe('MDIS Tashkent')
    expect(toCanonical('chorsu')).toBe('chorsu')
  })

  it('does not touch Cyrillic or bare vowels', () => {
    // Those are search-fold variants, not spellings anyone authored.
    // Folding "о" here would quietly rewrite Russian text.
    expect(toCanonical('Чорсу')).toBe('Чорсу')
    expect(toCanonical('Toshkent')).toBe('Toshkent')
  })

  it('is idempotent', () => {
    const once = toCanonical('koʻçasi, toʻğri')
    expect(toCanonical(once)).toBe(once)
  })
})

describe('findOfficialSpellings', () => {
  it('finds text that should have been canonical', () => {
    expect(findOfficialSpellings('koʻçasi')).not.toHaveLength(0)
    expect(findOfficialSpellings('yongʻoq')).not.toHaveLength(0)
  })

  it('passes clean new-alphabet text', () => {
    expect(findOfficialSpellings('Çorsu köçasi, Toşkent')).toEqual([])
    expect(findOfficialSpellings('Yönalişlar va baholar')).toEqual([])
  })

  it('catches the Uzbek apostrophes', () => {
    for (const q of ['ʻ', '‘', '’', 'ʼ']) {
      expect(findOfficialSpellings(`qo${q}shish`)).not.toHaveLength(0)
    }
  })

  it('does not report source code as a spelling error', () => {
    // Run over a .ts file, an ASCII apostrophe would report every
    // import as a spelling error and every --fix would break the build.
    expect(findOfficialSpellings("from './lib/rating'")).toEqual([])
    expect(findOfficialSpellings('const catalog = `x`')).toEqual([])
  })
})
