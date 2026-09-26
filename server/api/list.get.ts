import {
  catalog, categoryLabel, cityLabel, DEFAULT_CITY, districtLabel, pendingCount,
} from '../utils/catalog'
import { publishedFromQueue } from '../utils/published'

/** Lightweight list for the home page and the browse pages. */
export default defineEventHandler(async (event) => {
  const { category, district, limit, city } = getQuery(event) as {
    category?: string; district?: string; limit?: string; city?: string
  }

  /**
   * One city at a time, always.
   *
   * A directory that mixes Tashkent and Khorezm in one list is a worse
   * answer than either half: nobody is looking for "a bakery, anywhere in
   * the country". So an absent `city` means the default one rather than
   * all of them, and the counts below are scoped the same way — a tab
   * that says 6 must not be counting the other tab's listings.
   */
  /**
   * A district names its city, so asking for one is asking for the other.
   *
   * Without this, /tuman/hazorasp would filter Khorezm's district inside
   * Tashkent's listings and come back empty — a real page, correctly
   * rendered, showing nothing, with no clue why.
   */
  const districtCity = district
    ? catalog.districts.find((d) => d.slug === district)?.city
    : undefined
  const inCity = city || districtCity || DEFAULT_CITY.slug

  /**
   * YAML listings plus the ones approved from the queue.
   *
   * Queue listings come first: they are the newest thing in the
   * directory, and the point of approving one from a phone is seeing it
   * appear.
   */
  const everything = [...await publishedFromQueue(), ...catalog.businesses]
  const cityRows = everything.filter((b) => b.city === inCity)

  const matching = cityRows
    .filter((b) => (category ? b.categoryTop === category : true))
    .filter((b) => (district ? b.district === district : true))

  const shape = (b: (typeof matching)[number]) => ({
    slug: b.slug,
    name: b.name,
    address: b.address,
    categoryTop: b.categoryTop,
    categoryName: categoryLabel(b.category),
    districtName: b.district ? districtLabel(b.district) : undefined,
    city: b.city,
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
    // Only this city's districts: a Tashkent visitor has no use for a
    // filter chip labelled Hazorasp, and an empty one is worse than none.
    districts: catalog.districts.filter((d) => d.city === inCity),
    cities: catalog.cities.map((c) => ({
      slug: c.slug,
      name: c.name,
      count: everything.filter((b) => b.city === c.slug).length,
    })),
    city: inCity,
    cityName: cityLabel(inCity),
    // Which slug means `/`. The client builds tab links from this rather
    // than hard-coding "toshkent", so moving the default is a data change.
    defaultCity: DEFAULT_CITY.slug,
    total: matching.length,
    /**
     * Entries whose names are recorded but whose details are unverified.
     * A count only — an unverified listing is not something to show, but
     * a directory that is visibly being built reads very differently from
     * one that looks abandoned.
     */
    pending: pendingCount,
    counts: {
      categories: tally(cityRows.map((b) => b.categoryTop)),
      districts: tally(cityRows.map((b) => b.district)),
    },
  }
})
