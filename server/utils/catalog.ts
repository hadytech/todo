import { defaultCity, loadBusinesses, loadCategories, loadCities, loadDistricts, publishedOnly } from '../../lib/load'
import { lastModifiedByFile } from '../../lib/gitdates'

/**
 * Loaded once per build. Everything here runs at prerender time only —
 * there is no server at runtime, so this cost is paid by CI, not users.
 */
const { businesses } = loadBusinesses()
const modified = lastModifiedByFile('data/businesses')

/** ISO date of the last commit touching a business's file, if known. */
export function lastModified(slug: string): string | undefined {
  return modified.get(`data/businesses/${slug}.yaml`)
}

/** Listings recorded but not yet verified. See `npm run todo`. */
export const pendingCount = businesses.filter((b) => b.status !== 'published').length

export const catalog = {
  businesses: publishedOnly(businesses),
  categories: loadCategories(),
  districts: loadDistricts(),
  cities: loadCities(),
}

/** The city `/` shows, and the one a listing means when it says nothing. */
export const DEFAULT_CITY = defaultCity(catalog.cities)

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
