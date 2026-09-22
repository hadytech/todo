import { catalog } from '../utils/catalog'

/**
 * Just the filter vocabulary. Separate from /api/list so the search page
 * does not inline the whole directory into its payload — that cost grows
 * with every listing added.
 */
export default defineEventHandler(() => ({
  // Children are carried too: /qoshish needs the full "asosiy/ichki"
  // vocabulary to build its category picker, and a second endpoint for
  // the same tree would be one more thing to keep in step.
  categories: catalog.categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    children: c.children.map((ch) => ({ slug: ch.slug, name: ch.name })),
  })),
  districts: catalog.districts,
}))
