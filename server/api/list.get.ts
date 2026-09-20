import { catalog, categoryLabel, districtLabel } from '../utils/catalog'

/** Lightweight list for the home page and the browse pages. */
export default defineEventHandler((event) => {
  const { category, district, limit } = getQuery(event) as {
    category?: string; district?: string; limit?: string
  }

  const matching = catalog.businesses
    .filter((b) => (category ? b.categoryTop === category : true))
    .filter((b) => (district ? b.district === district : true))

  const shape = (b: (typeof matching)[number]) => ({
    slug: b.slug,
    name: b.name,
    address: b.address,
    categoryTop: b.categoryTop,
    categoryName: categoryLabel(b.category),
    districtName: districtLabel(b.district),
    price: b.price,
    photo: b.photos[0]?.file ?? null,
  })

  // The home page needs eight rows and some counts, not the whole
  // directory. Without a limit its payload grows with every listing added.
  const n = limit ? Number(limit) : undefined
  const items = (n && n > 0 ? matching.slice(0, n) : matching).map(shape)

  const tally = <T extends string>(keys: T[]) =>
    keys.reduce<Record<string, number>>((acc, k) => { acc[k] = (acc[k] ?? 0) + 1; return acc }, {})

  return {
    items,
    categories: catalog.categories,
    districts: catalog.districts,
    total: matching.length,
    counts: {
      categories: tally(catalog.businesses.map((b) => b.categoryTop)),
      districts: tally(catalog.businesses.map((b) => b.district)),
    },
  }
})
