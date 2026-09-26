import { z } from 'zod'
import { db, dbConfigured } from '../../utils/db'
import { ensureSchema } from '../../utils/migrate'
import { requireAdmin } from '../../utils/admin'
import { requireSameOrigin } from '../../utils/sameorigin'
import { catalog, DEFAULT_CITY } from '../../utils/catalog'
import { toSlug } from '../../../lib/alphabet'

const Body = z.object({
  id: z.string().uuid(),
  action: z.enum(['publish', 'reject']),
  /** Corrections made while reviewing. All optional; absent means keep. */
  name: z.string().trim().min(2).max(120).optional(),
  category: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/).optional(),
  city: z.string().regex(/^[a-z0-9-]+$/).optional(),
  district: z.string().regex(/^[a-z0-9-]+$/).optional(),
  note: z.string().trim().max(300).optional(),
})

/**
 * Approve a suggestion into a live listing, or turn it down.
 *
 * Approving assigns a slug and flips the row to `published`, after which
 * /api/list and /api/business serve it beside the YAML listings. It is
 * not a permanent home: `npm run submissions import` still moves good
 * ones into git, where a directory's facts belong and where they can be
 * reviewed and reverted. This is what makes the queue workable from a
 * phone in the meantime.
 *
 * A category is required to publish. Everything else can be missing — a
 * name and a category is a listing; an address is a detail somebody can
 * add later.
 */
export default defineEventHandler(async (event) => {
  if (!dbConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Maʼlumotlar bazasi ulanmagan' })
  }
  requireSameOrigin(event)
  requireAdmin(event)
  await ensureSchema()

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Sörov notöğri' })
  const b = parsed.data

  const sql = db()

  if (b.action === 'reject') {
    const done = await sql`
      update submissions
         set status = 'rejected', reviewed_at = now(), review_note = ${b.note ?? null}
       where id = ${b.id} and status = 'pending'
      returning id
    `
    if (!done.length) throw createError({ statusCode: 404, statusMessage: 'Taklif topilmadi' })
    return { ok: true, status: 'rejected' }
  }

  const [row] = await sql<{ name: string; category: string | null; city: string }[]>`
    select name, category, city from submissions where id = ${b.id} and status = 'pending'
  `
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Taklif topilmadi' })

  const name = b.name ?? row.name
  const category = b.category ?? row.category
  if (!category) {
    throw createError({ statusCode: 400, statusMessage: 'Avval turini tanlang' })
  }
  const known = catalog.categories.some((c) =>
    c.children.some((ch) => `${c.slug}/${ch.slug}` === category))
  if (!known) throw createError({ statusCode: 400, statusMessage: 'Turi notöğri' })

  const city = b.city ?? row.city ?? DEFAULT_CITY.slug
  if (!catalog.cities.some((c) => c.slug === city)) {
    throw createError({ statusCode: 400, statusMessage: 'Bunday şahar yöq' })
  }
  if (b.district) {
    const d = catalog.districts.find((x) => x.slug === b.district)
    if (!d) throw createError({ statusCode: 400, statusMessage: 'Notaʼnış tuman' })
    if (d.city !== city) {
      throw createError({ statusCode: 400, statusMessage: 'Tuman tanlangan şaharda emas' })
    }
  }

  /**
   * A slug nothing else is using.
   *
   * Checked against both sources: the YAML listings, whose slugs are
   * prerendered paths, and the suggestions already published. A collision
   * would mean two places at one URL, and the prerendered file would win
   * — so the newer one would simply be invisible.
   */
  const base = toSlug(name) || 'joy'
  const takenInYaml = new Set(catalog.businesses.map((x) => x.slug))
  const takenInDb = new Set(
    (await sql<{ slug: string }[]>`select slug from submissions where slug is not null`)
      .map((x) => x.slug),
  )
  let slug = base
  for (let n = 2; takenInYaml.has(slug) || takenInDb.has(slug); n += 1) slug = `${base}-${n}`

  await sql`
    update submissions
       set status = 'published',
           slug = ${slug},
           name = ${name},
           category = ${category},
           city = ${city},
           district = ${b.district ?? null},
           reviewed_at = now(),
           review_note = ${b.note ?? null}
     where id = ${b.id} and status = 'pending'
  `

  return { ok: true, status: 'published', slug }
})
