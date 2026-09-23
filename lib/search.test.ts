import { describe, it, expect } from 'vitest'
import MiniSearch from 'minisearch'
import { searchOptions, type IndexedBusiness } from './search'
import { SYNONYMS, synonymsFor } from './synonyms'
import { loadCategories } from './load'

/** A small fixture standing in for the real catalogue. */
const DOCS: IndexedBusiness[] = [
  { id: 'oq-dorixona', name: 'Oq Dorixona', address: 'Amir Temur şoh köçasi 120',
    category: 'Soğliq Dorixonalar', district: 'Yunusobod',
    terms: synonymsFor('sogliq/dorixona').join(' '), lat: 41.367, lng: 69.282 },
  { id: 'shaffof-sartaroshxona', name: 'Şaffof Sartaroşxona', address: 'Qatortol köçasi 3',
    category: 'Gözallik Sartaroşxonalar', district: 'Çilonzor',
    terms: synonymsFor('gozallik/sartaroshxona').join(' '), lat: 41.279, lng: 69.21 },
  { id: 'chorsu-choyxona', name: 'Çorsu Çoyxonasi', address: 'Çorsu bozori',
    category: 'Ovqatlanish Çoyxonalar', district: 'Şayxontohur',
    terms: synonymsFor('ovqatlanish/choyxona').join(' '), lat: 41.326, lng: 69.235 },
  { id: 'apteka-kafesi', name: 'Apteka Kafesi', address: 'Bobur köçasi 1',
    category: 'Ovqatlanish Kafelar', district: 'Mirobod',
    terms: synonymsFor('ovqatlanish/kafe').join(' '), lat: 41.3, lng: 69.28 },
]

function index() {
  const mini = new MiniSearch<IndexedBusiness>(searchOptions)
  mini.addAll(DOCS)
  return mini
}

const ids = (q: string) => index().search(q).map((r) => r.id)

describe('search — other languages, not just other scripts', () => {
  it('finds a dorixona from the Russian word', () => {
    expect(ids('аптека')).toContain('oq-dorixona')
  })

  it('finds a sartaroşxona from the Russian word', () => {
    expect(ids('парикмахерская')).toContain('shaffof-sartaroshxona')
  })

  it('finds a çoyxona from the Russian word', () => {
    expect(ids('чайхана')).toContain('chorsu-choyxona')
  })

  it('finds a dorixona from the English word', () => {
    expect(ids('pharmacy')).toContain('oq-dorixona')
  })
})

describe('search — ranking', () => {
  it('ranks a real name above a synonym match', () => {
    // "Apteka Kafesi" is literally called that; the pharmacy only matches
    // through a synonym. The name must win, or a synonym hijacks the query.
    expect(ids('apteka')[0]).toBe('apteka-kafesi')
  })

  it('does not drag in unrelated categories', () => {
    expect(ids('аптека')).not.toContain('chorsu-choyxona')
  })
})

describe('search — cross-alphabet, through the real index', () => {
  const spellings = ['Çorsu', 'Chorsu', "Cho'rsu", 'Чорсу']

  for (const s of spellings) {
    it(`finds the çoyxona when searching "${s}"`, () => {
      expect(ids(s)).toContain('chorsu-choyxona')
    })
  }
})

describe('SYNONYMS', () => {
  it('has no key that is not a real category', () => {
    // A typo'd key fails silently — the synonyms simply never apply.
    const real = new Set(
      loadCategories().flatMap((c) => c.children.map((ch) => `${c.slug}/${ch.slug}`)),
    )
    for (const key of Object.keys(SYNONYMS)) expect(real).toContain(key)
  })

  it('covers every category in the catalogue', () => {
    for (const c of loadCategories()) {
      for (const child of c.children) {
        expect(synonymsFor(`${c.slug}/${child.slug}`).length).toBeGreaterThan(0)
      }
    }
  })
})
