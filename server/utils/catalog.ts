import { lastModifiedByFile } from '../../lib/gitdates'
import { CATALOG } from './catalog.generated'

/**
 * The directory's facts, baked into the bundle at build time.
 *
 * This used to read data/*.yaml with `readFileSync` when the module
 * loaded. That is correct everywhere except where it runs: a serverless
 * function ships JavaScript and no `data/` directory, so the read threw
 * and every endpoint importing this answered 500 — the add form had no
 * categories, submitting a place failed, reviews could not be read.
 *
 * Nothing caught it because the pages showing this data are prerendered
 * in CI, where the files exist. See scripts/build-catalog.ts.
 */
export const catalog = {
  businesses: CATALOG.businesses,
  categories: CATALOG.categories,
  districts: CATALOG.districts,
  cities: CATALOG.cities,
}

/** Listings recorded but not yet verified. See `npm run todo`. */
export const pendingCount = CATALOG.pendingCount

/**
 * Last commit date per listing, for the sitemap's <lastmod>.
 *
 * Still read from git rather than baked in: it changes with history
 * rather than with data, and the sitemap that uses it is prerendered in
 * CI where git is present. `lastModifiedByFile` returns an empty map
 * wherever git is not, and callers omit lastmod rather than invent one.
 */
const modified = lastModifiedByFile('data/businesses')

/** ISO date of the last commit touching a business's file, if known. */
export function lastModified(slug: string): string | undefined {
  return modified.get(`data/businesses/${slug}.yaml`)
}

/**
 * The city `/` shows, and the one a listing means when it says nothing.
 *
 * Computed here rather than imported from lib/load, so that module — and
 * the fs, path and yaml it pulls with it — never enters a function bundle
 * that has no filesystem to read.
 */
export const DEFAULT_CITY = catalog.cities.find((c) => c.default) ?? catalog.cities[0]!

export function cityLabel(slug: string): string {
  return catalog.cities.find((c) => c.slug === slug)?.name ?? slug
}

/** Districts of one city, in the order data/districts.yaml lists them. */
export function districtsOf(city: string) {
  return catalog.districts.filter((d) => d.city === city)
}

export function categoryLabel(path: string): string {
  const [top, sub] = path.split('/')
  const c = catalog.categories.find((x) => x.slug === top)
  return c?.children.find((x) => x.slug === sub)?.name ?? path
}

export function districtLabel(slug: string): string {
  return catalog.districts.find((d) => d.slug === slug)?.name ?? slug
}
