import { z } from 'zod'

/**
 * The shape of every file in data/businesses/*.yaml.
 *
 * The filename IS the slug — it shows up in the URL and in every PR diff,
 * so renaming a file is a visible, reviewable act rather than a silent
 * change to a field nobody reads.
 *
 * Text fields are authored in the NEW Uzbek Latin alphabet (ö ğ ç ş).
 * Standard-Latin, ASCII and search forms are all derived at build time by
 * lib/alphabet.ts — never stored, so they can never drift.
 */

const TIME = /^([01]\d|2[0-4]):([0-5]\d)$/

const timeRange = z
  .tuple([
    z.string().regex(TIME, 'vaqt HH:MM formatida bölsin'),
    z.string().regex(TIME, 'vaqt HH:MM formatida bölsin'),
  ])
  .refine(([open, close]) => open < close, {
    message: 'ochilish vaqti yopilish vaqtidan oldin bölsin (kechasi yopiladigan joy uchun 24:00 ishlating)',
  })

/**
 * Several ranges in one day — a lunch break, typically. Ranges must be in
 * order and must not overlap, or "open now" becomes ambiguous.
 */
const timeRanges = z
  .array(timeRange)
  .min(1)
  .max(3)
  .refine(
    (rs) => rs.every((r, i) => i === 0 || rs[i - 1]![1] <= r[0]!),
    { message: 'vaqt oraliqlari tartib böyicha va bir-birining ustiga tuşmasin' },
  )

/**
 * A day is closed, one range, or several.
 *
 * The union needs an explicit errorMap: Zod's default for a failed union
 * is the bare "Invalid input", which tells a first-time PR contributor
 * nothing about what shape the field wants.
 */
const day = z.union([z.literal('closed'), timeRange, timeRanges], {
  errorMap: () => ({
    message:
      'kun "closed", ["HH:MM", "HH:MM"], yoki tanaffusli bölsa '
      + '[["09:00","15:00"], ["18:00","23:00"]] körinişida bölsin',
  }),
})

export { WEEKDAYS, type Weekday } from './hours'

const hours = z.object({
  mon: day, tue: day, wed: day, thu: day,
  fri: day, sat: day, sun: day,
}).partial()

const photo = z.object({
  /** Filename inside public/photos/. Keep AVIF and under ~60KB — repo budget is 1GB. */
  file: z.string().min(1),
  /** Written in new Latin; the ASCII form is derived for the img alt attribute. */
  alt: z.string().min(1).max(200),
})

export const businessSchema = z.object({
  name: z.string().min(2).max(120),
  /**
   * Which city or region. Slug from data/cities.yaml.
   *
   * Defaulted rather than required, so every listing written before there
   * was more than one city stays valid and means what it always meant.
   * `npm run validate` checks the value exists and that the district
   * belongs to it — a Khorezm district on a Tashkent listing is the exact
   * mistake this catches.
   */
  city: z.string().regex(/^[a-z0-9-]+$/).default('toshkent'),
  /** "top/sub", matching data/categories.yaml. */
  category: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'kategoriya "asosiy/ichki" körinishida bölsin'),
  /** Slug from data/districts.yaml. Optional on a draft. */
  district: z.string().regex(/^[a-z0-9-]+$/).optional(),
  address: z.string().min(4).max(300).optional(),
  /**
   * The pin. Checked against the city's own box in lib/load.ts, not here.
   *
   * It used to carry Tashkent's bounds inline, which was right while there
   * was one city and silently wrong the moment there were two — every
   * Khorezm listing would have failed the build with a message about a
   * range nobody had written down. The generous outer bounds here only
   * catch a swapped lat/lng or a missing minus.
   */
  location: z.object({
    lat: z.number().min(37).max(46),
    lng: z.number().min(55).max(74),
  }).optional(),
  description: z.string().max(1200).optional(),
  phones: z.array(
    z.string().regex(/^\+998 \d{2} \d{3} \d{2} \d{2}$/, 'telefon "+998 XX XXX XX XX" formatida bölsin'),
  ).max(3).default([]),
  telegram: z.string().regex(/^@[A-Za-z0-9_]{4,32}$/).optional(),
  instagram: z.string().regex(/^[A-Za-z0-9_.]{1,30}$/).optional(),
  website: z.string().url().optional(),
  /** 1 = arzon, 4 = qimmat. */
  price: z.number().int().min(1).max(4).optional(),
  hours: hours.optional(),
  photos: z.array(photo).max(8).default([]),
  status: z.enum(['published', 'draft', 'hidden']).default('published'),
  /** Free-form note for maintainers. Never rendered. */
  note: z.string().optional(),
}).strict().superRefine((b, ctx) => {
  /**
   * Address and location are optional only for drafts.
   *
   * That makes `status: draft` a to-verify queue rather than a staging
   * area for invented data: a name and a district can be recorded from
   * something known, and the details someone has to actually confirm stay
   * empty until they do. A published listing still cannot exist without
   * them, so nothing half-known can reach the site.
   */
  if (b.status !== 'published') return

  for (const field of ['address', 'location', 'district'] as const) {
    if (!b[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `"published" joy uchun ${field} majburiy (tekşirilmagan bölsa: status: draft)`,
      })
    }
  }
})

export type BusinessInput = z.infer<typeof businessSchema>

export const categoriesSchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  icon: z.string().optional(),
  children: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(2),
  })).min(1),
})).min(1)

export const districtsSchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  /** Slug from data/cities.yaml. */
  city: z.string().regex(/^[a-z0-9-]+$/),
})).min(1)

/**
 * Cities and regions the directory covers.
 *
 * `bbox` is a sanity range for coordinates, not a boundary: its job is to
 * catch a pin that landed in the ocean, not to trace a border.
 */
export const citiesSchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  bbox: z.object({
    latMin: z.number(), latMax: z.number(),
    lngMin: z.number(), lngMax: z.number(),
  }),
  /** Exactly one city is the default: the one `/` shows. */
  default: z.boolean().optional(),
})).min(1).superRefine((cities, ctx) => {
  const defaults = cities.filter((c) => c.default)
  if (defaults.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `bitta şahar "default: true" bölişi kerak (hozir ${defaults.length} ta)`,
    })
  }
})
