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
    z.string().regex(TIME, 'vaqt HH:MM formatida boʻlsin'),
    z.string().regex(TIME, 'vaqt HH:MM formatida boʻlsin'),
  ])
  .refine(([open, close]) => open < close, {
    message: 'ochilish vaqti yopilish vaqtidan oldin boʻlsin (kechasi yopiladigan joy uchun 24:00 ishlating)',
  })

/**
 * A day is either closed, or one open..close range.
 *
 * The union needs an explicit errorMap: Zod's default for a failed union
 * is the bare "Invalid input", which tells a first-time PR contributor
 * nothing about what shape the field wants.
 */
const day = z.union([z.literal('closed'), timeRange], {
  errorMap: () => ({ message: 'kun "closed" yoki ["HH:MM", "HH:MM"] koʻrinişida boʻlsin' }),
})

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

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
  /** "top/sub", matching data/categories.yaml. */
  category: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'kategoriya "asosiy/ichki" koʻrinishida boʻlsin'),
  /** Slug from data/districts.yaml. */
  district: z.string().regex(/^[a-z0-9-]+$/),
  address: z.string().min(4).max(300),
  location: z.object({
    // Tashkent bounding box. A typo'd coordinate lands the pin in the
    // ocean and nobody notices until launch, so fail the build instead.
    lat: z.number().min(41.15).max(41.45),
    lng: z.number().min(69.10).max(69.55),
  }),
  description: z.string().max(1200).optional(),
  phones: z.array(
    z.string().regex(/^\+998 \d{2} \d{3} \d{2} \d{2}$/, 'telefon "+998 XX XXX XX XX" formatida boʻlsin'),
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
}).strict()

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
})).min(1)
