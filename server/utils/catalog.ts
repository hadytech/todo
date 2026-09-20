import { loadBusinesses, loadCategories, loadDistricts, publishedOnly } from '../../lib/load'

/**
 * Loaded once per build. Everything here runs at prerender time only —
 * there is no server at runtime, so this cost is paid by CI, not users.
 */
const { businesses } = loadBusinesses()

export const catalog = {
  businesses: publishedOnly(businesses),
  categories: loadCategories(),
  districts: loadDistricts(),
}

export function categoryLabel(path: string): string {
  const [top, sub] = path.split('/')
  const c = catalog.categories.find((x) => x.slug === top)
  return c?.children.find((x) => x.slug === sub)?.name ?? path
}

export function districtLabel(slug: string): string {
  return catalog.districts.find((d) => d.slug === slug)?.name ?? slug
}
