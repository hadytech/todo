import { catalog } from '../utils/catalog'

/**
 * Just the filter vocabulary. Separate from /api/list so the search page
 * does not inline the whole directory into its payload — that cost grows
 * with every listing added.
 */
export default defineEventHandler(() => ({
  categories: catalog.categories.map((c) => ({ slug: c.slug, name: c.name })),
  districts: catalog.districts,
}))
