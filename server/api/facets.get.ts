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
  /**
   * Cities, each with its own districts.
   *
   * Carried together rather than as two flat lists the client has to
   * re-join: the add form has to show one city's districts and only one
   * city's, and a join written in three components is a join written
   * wrong in at least one of them.
   */
  cities: catalog.cities.map((c) => ({
    slug: c.slug,
    name: c.name,
    default: c.default ?? false,
    districts: catalog.districts
      .filter((d) => d.city === c.slug)
      .map((d) => ({ slug: d.slug, name: d.name })),
  })),
}))
