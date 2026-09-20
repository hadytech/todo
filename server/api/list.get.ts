import { catalog, categoryLabel, districtLabel } from '../utils/catalog'

/** Lightweight list for the home page and the category x district pages. */
export default defineEventHandler((event) => {
  const { category, district } = getQuery(event) as { category?: string; district?: string }

  const items = catalog.businesses
    .filter((b) => (category ? b.categoryTop === category : true))
    .filter((b) => (district ? b.district === district : true))
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      address: b.address,
      categoryTop: b.categoryTop,
      categoryName: categoryLabel(b.category),
      districtName: districtLabel(b.district),
      price: b.price,
      photo: b.photos[0]?.file ?? null,
    }))

  return {
    items,
    categories: catalog.categories,
    districts: catalog.districts,
    total: catalog.businesses.length,
    /**
     * Which district x category pages actually have listings. The home
     * page links only these: an empty landing page is thin content that
     * drags down the pages that do rank, and it is a dead end for a
     * visitor who taps it.
     */
    combos: [...new Set(catalog.businesses.map((b) => `${b.district}/${b.categoryTop}`))],
  }
})
