/**
 * What still needs verifying.  `npm run todo`
 *
 * Drafts are a queue of known names waiting on the details a person has
 * to confirm. This prints what each one is missing so the work can be
 * picked up a few at a time, instead of being a directory of files
 * nobody remembers the state of.
 */
import { loadBusinesses, loadCategories } from '../lib/load'

const { businesses } = loadBusinesses()
const drafts = businesses.filter((b) => b.status !== 'published')

if (!drafts.length) {
  console.log('Tekşirişni kutayotgan joy yoʻq.')
  process.exit(0)
}

const categoryNames = new Map(
  loadCategories().flatMap((c) => c.children.map((ch) => [`${c.slug}/${ch.slug}`, `${c.name} → ${ch.name}`])),
)

const byCategory = new Map<string, typeof drafts>()
for (const d of drafts) {
  const key = categoryNames.get(d.category) ?? d.category
  byCategory.set(key, [...(byCategory.get(key) ?? []), d])
}

const REQUIRED = [
  ['district', 'tuman'],
  ['address', 'manzil'],
  ['location', 'koordinata'],
  ['hours', 'iş vaqti'],
  ['phones', 'telefon'],
] as const

for (const [category, list] of [...byCategory].sort()) {
  console.log(`\n${category}  (${list.length})`)
  for (const b of list) {
    const missing = REQUIRED
      .filter(([field]) => {
        const v = (b as Record<string, unknown>)[field]
        return !v || (Array.isArray(v) && !v.length)
      })
      .map(([, label]) => label)
    console.log(`   ${b.name}`)
    console.log(`     ${b.slug}.yaml — kerak: ${missing.join(', ') || 'hammasi bor, status: published qiling'}`)
  }
}

const ready = drafts.filter((b) => b.district && b.address && b.location)
console.log(
  `\n${drafts.length} ta qoralama. `
  + (ready.length
    ? `${ready.length} tasi toʻliq — status: published qilsa boʻladi.`
    : 'Hech biri hali toʻliq emas.'),
)
console.log('Toʻldiriş uchun: npm run entry (yoki faylni qoʻlda tahrirlang)')
