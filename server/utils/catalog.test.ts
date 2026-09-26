import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { render } from '../../scripts/build-catalog'
import { CATALOG } from './catalog.generated'

/**
 * The baked catalogue has to match data/*.yaml.
 *
 * Same guard as the generated schema, and it earns its keep the same way:
 * a stale copy is not a crash, it is a site quietly serving last week's
 * listings while the YAML says otherwise.
 */
describe('generated catalogue', () => {
  it('is up to date with data/*.yaml', () => {
    expect(render()).toBe(readFileSync('server/utils/catalog.generated.ts', 'utf8'))
  })

  it('carries what the endpoints read', () => {
    expect(CATALOG.categories.length).toBeGreaterThan(0)
    expect(CATALOG.districts.length).toBeGreaterThan(0)
    expect(CATALOG.cities.length).toBeGreaterThan(1)
    expect(CATALOG.cities.filter((c) => c.default)).toHaveLength(1)
  })

  it('has a district for every city, and a city for every district', () => {
    const cities = new Set(CATALOG.cities.map((c) => c.slug))
    for (const d of CATALOG.districts) expect(cities).toContain(d.city)
    for (const c of cities) {
      expect(CATALOG.districts.some((d) => d.city === c)).toBe(true)
    }
  })

  it('gives every published listing a city that exists', () => {
    const cities = new Set(CATALOG.cities.map((c) => c.slug))
    for (const b of CATALOG.businesses) expect(cities).toContain(b.city)
  })
})
