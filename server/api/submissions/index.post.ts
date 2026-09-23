import { z } from 'zod'
import { db, dbConfigured } from '../../utils/db'
import { currentUser } from '../../utils/auth'
import { checkSubmissionRate, clientIp } from '../../utils/ratelimit'
import { catalog } from '../../utils/catalog'
import { normalisePhone } from '../../../lib/phone'
import { MAX_ENCODED } from '../../../lib/photo'

/**
 * Accept a place suggested from the site.
 *
 * No account required, by design. The directory's whole problem is that
 * the people who know which barber is good are not the people who have
 * a GitHub account, and every field of friction between them and the
 * form costs more listings than it saves in spam.
 *
 * What lands here is a suggestion, not a listing: it is written to the
 * submissions inbox and never rendered. `npm run submissions` turns the
 * good ones into YAML drafts, which go through git like every other
 * change to the directory's facts.
 */
const optional = (s: z.ZodString) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), s.optional())

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  district: optional(z.string().regex(/^[a-z0-9-]+$/)),
  address: optional(z.string().trim().max(300)),

  // Tashkent's bounding box, the same one the YAML schema enforces. A
  // pin outside it is a mistake, not a listing in another city.
  lat: z.number().min(41.15).max(41.45).optional(),
  lng: z.number().min(69.10).max(69.55).optional(),

  // Phone is accepted in whatever shape someone types it and normalised
  // below. Rejecting "90 123 45 67" because it lacks +998 is the kind of
  // pedantry that makes people give up on a form.
  phone: optional(z.string().trim().max(40)),
  website: optional(z.string().trim().max(200)),
  telegram: optional(z.string().trim().max(40)),
  instagram: optional(z.string().trim().max(40)),
  hoursNote: optional(z.string().trim().max(300)),

  /**
   * The submitter's own rating, because adding a place and having an
   * opinion about it are the same act.
   */
  rating: z.number().int().min(1).max(5).optional(),

  /**
   * A JPEG data URL, already resized in the browser.
   *
   * The size ceiling is enforced here as well as on the device: a limit
   * that only exists in the client is not a limit, and an unbounded
   * string field is a cheap way to fill a free database.
   */
  photo: optional(
    z.string()
      .max(MAX_ENCODED, 'rasm juda katta')
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'rasm formati notöğri'),
  ),
  comment: optional(z.string().trim().max(1000)),
  contact: optional(z.string().trim().max(200)),

  /**
   * Honeypot. Hidden from people, irresistible to the kind of bot that
   * fills every input it finds.
   *
   * Accepted as any string here, deliberately. Rejecting a filled one in
   * the schema would 400 — telling the bot the form saw something it did
   * not like, which is exactly the feedback that gets a honeypot
   * detected. It is checked after parsing and answered with a plain ok.
   */
  website2: z.string().max(200).optional(),
})

export default defineEventHandler(async (event) => {
  if (!dbConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Forma vaqtincha işlamayapti — GitHub orqali yuboring',
    })
  }

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    throw createError({
      statusCode: 400,
      statusMessage: field === 'name'
        ? 'Joy nomini yozing'
        : field === 'lat' || field === 'lng'
          ? 'Nuqta Toşkent içida bölsin'
          : field === 'photo'
            ? 'Rasmni yuborib bölmadi — boşqa rasm tanlang'
            : 'Formani tekşirib qayta yuboring',
    })
  }
  const b = parsed.data

  // Silently accepted, never stored. A bot that gets "ok" stops trying.
  if (b.website2) return { ok: true }

  // The category has to exist, or the suggestion cannot be filed. The
  // district is checked too, but a wrong one is a typo a maintainer
  // fixes, not a reason to reject the whole submission.
  const known = catalog.categories.some((c) =>
    c.children.some((ch) => `${c.slug}/${ch.slug}` === b.category))
  if (!known) throw createError({ statusCode: 400, statusMessage: 'Kategoriya notöğri' })

  const ip = clientIp(event)
  await checkSubmissionRate(ip)

  const user = await currentUser(event).catch(() => null)

  const [row] = await db()<{ id: string }[]>`
    insert into submissions (
      name, category, district, address, lat, lng,
      phone, website, telegram, instagram,
      hours_note, comment, contact, rating, photo, user_id, submitted_ip
    ) values (
      ${b.name}, ${b.category}, ${b.district ?? null}, ${b.address ?? null},
      ${b.lat ?? null}, ${b.lng ?? null},
      ${normalisePhone(b.phone) ?? null}, ${b.website ?? null},
      ${b.telegram ?? null}, ${b.instagram ?? null},
      ${b.hoursNote ?? null}, ${b.comment ?? null}, ${b.contact ?? null},
      ${b.rating ?? null}, ${b.photo ?? null},
      ${user?.id ?? null}, ${ip}
    )
    returning id
  `

  return { ok: true, id: row!.id }
})
