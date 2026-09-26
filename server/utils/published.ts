import { db, dbConfigured } from './db'
import { ensureSchema } from './migrate'

/**
 * Listings that were approved from the site rather than committed to git.
 *
 * The directory's facts live in data/businesses/*.yaml, under review,
 * because a directory should be auditable and revertable. That has not
 * changed. What has changed is that a suggestion no longer has to wait
 * for somebody to be at a laptop before it is visible: approving one from
 * the queue makes it a listing served from here, and
 * `npm run submissions import` still moves it into YAML afterwards — at
 * which point the file is the source and the row stops being served.
 *
 * Shaped exactly like a catalogue entry so callers can concatenate the
 * two without knowing which is which.
 */
export interface DbBusiness {
  slug: string
  name: string
  category: string
  categoryTop: string
  city: string
  district: string | undefined
  address: string | undefined
  phones: string[]
  website: string | undefined
  location: { lat: number; lng: number } | undefined
  photos: never[]
  status: 'published'
  /** True for a row served from the database, so callers can tell. */
  fromQueue: true
}

export async function publishedFromQueue(): Promise<DbBusiness[]> {
  if (!dbConfigured()) return []
  try {
    await ensureSchema()
    const rows = await db()<{
      slug: string
      name: string
      category: string
      city: string
      district: string | null
      address: string | null
      phone: string | null
      website: string | null
      lat: number | null
      lng: number | null
    }[]>`
      select slug, name, category, city, district, address, phone, website, lat, lng
        from submissions
       where status = 'published' and slug is not null and category is not null
    order by reviewed_at desc
       limit 500
    `
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      category: r.category,
      categoryTop: r.category.split('/')[0]!,
      city: r.city,
      district: r.district ?? undefined,
      address: r.address ?? undefined,
      phones: r.phone ? [r.phone] : [],
      website: r.website ?? undefined,
      location: r.lat !== null && r.lng !== null ? { lat: r.lat, lng: r.lng } : undefined,
      photos: [],
      status: 'published' as const,
      fromQueue: true as const,
    }))
  } catch (error) {
    /**
     * Never fatal.
     *
     * These are an addition to the directory, not the directory. A
     * database hiccup should cost the newest listings, not the page —
     * the YAML ones are right there in the bundle and owe nothing to a
     * connection.
     */
    console.error('[queue] published listings unavailable:', error instanceof Error ? error.message : error)
    return []
  }
}
