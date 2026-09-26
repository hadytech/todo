import { db, dbConfigured } from '../../utils/db'
import { ensureSchema } from '../../utils/migrate'
import { isAdmin, adminConfigured } from '../../utils/admin'
import { catalog, categoryLabel, cityLabel, districtLabel } from '../../utils/catalog'

export interface QueueRow {
  id: string
  name: string
  category: string | null
  categoryName: string | null
  city: string
  cityName: string
  district: string | null
  districtName: string | null
  address: string | null
  comment: string | null
  contact: string | null
  hoursNote: string | null
  phone: string | null
  website: string | null
  rating: number | null
  lat: number | null
  lng: number | null
  /** Data URL, shown inline. Never large: capped at 400KB on the way in. */
  photo: string | null
  createdAt: string
  status: string
  slug: string | null
}

/**
 * The suggestions queue.
 *
 * Returns `{ admin: false }` rather than 404 when nobody is signed in, so
 * the page can show a token form instead of an error — the endpoint that
 * *acts* is the one that must not distinguish.
 */
export default defineEventHandler(async (event) => {
  if (!dbConfigured()) return { admin: false, configured: false, rows: [], counts: {} }
  if (!isAdmin(event)) return { admin: false, configured: adminConfigured(), rows: [], counts: {} }

  await ensureSchema()
  const sql = db()

  const rows = await sql<QueueRow[]>`
    select id, name, category, city, district, address, comment, contact,
           hours_note as "hoursNote", phone, website, rating, lat, lng, photo,
           created_at as "createdAt", status, slug
      from submissions
     where status = 'pending'
  order by created_at asc
     limit 100
  `

  const [tally] = await sql<{ pending: number; published: number; rejected: number }[]>`
    select count(*) filter (where status = 'pending')   ::int as pending,
           count(*) filter (where status = 'published') ::int as published,
           count(*) filter (where status = 'rejected')  ::int as rejected
      from submissions
  `

  return {
    admin: true,
    configured: true,
    counts: tally ?? { pending: 0, published: 0, rejected: 0 },
    // Labels resolved here rather than in the page: the queue shows a
    // category slug nobody can read otherwise, and the page should not
    // have to carry the whole vocabulary to render one row.
    rows: rows.map((r) => ({
      ...r,
      categoryName: r.category ? categoryLabel(r.category) : null,
      districtName: r.district ? districtLabel(r.district) : null,
      cityName: cityLabel(r.city),
    })),
    categories: catalog.categories,
    cities: catalog.cities.map((c) => ({
      slug: c.slug,
      name: c.name,
      districts: catalog.districts.filter((d) => d.city === c.slug)
        .map((d) => ({ slug: d.slug, name: d.name })),
    })),
  }
})
