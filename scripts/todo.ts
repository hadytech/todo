/**
 * What still needs verifying.  `npm run todo`
 *
 * Drafts are a queue of known names waiting on the details a person has
 * to confirm. This prints what each one is missing so the work can be
 * picked up a few at a time, instead of being a directory of files
 * nobody remembers the state of.
 */
import { loadBusinesses, loadCategories } from '../lib/load'
import { toAscii } from '../lib/alphabet'

/**
 * A ready-made map search for one draft.
 *
 * Coordinates are the one field that cannot be researched from a desk —
 * every geocoder worth trusting wants an API key, and a pin guessed from
 * a street name lands on the wrong building. So the next best thing is to
 * make the manual step as short as possible: open this, right-click the
 * pin, copy the coordinates, paste them into `npm run entry`, which
 * already parses a Yandex or Google URL.
 *
 * The query is ASCII: Yandex handles the new alphabet poorly, and the
 * ASCII spelling is the one the map's own data uses.
 */
function mapSearch(name: string, address?: string): string {
  const q = toAscii(`${name} ${address ?? 'Toshkent'}`)
  return `https://yandex.uz/maps/10335/tashkent/search/${encodeURIComponent(q)}`
}

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
    // Only where a coordinate is what is missing — printing a map link
    // next to a row that needs a phone number is noise.
    if (!b.location) console.log(`     xarita: ${mapSearch(b.name, b.address)}`)
  }
}

const ready = drafts.filter((b) => b.district && b.address && b.location)
console.log(
  `\n${drafts.length} ta qoralama. `
  + (ready.length
    ? `${ready.length} tasi toʻliq — status: published qilsa boʻladi.`
    : 'Hech biri hali toʻliq emas.'),
)
const needCoords = drafts.filter((b) => !b.location).length
if (needCoords) {
  console.log(
    `${needCoords} tasida koordinata kerak. `
    + 'Xarita havolasini oçing → nuqtani oʻng tugma bilan bosing '
    + '→ koordinatani nusxalang → `npm run entry` ga joylaştiring.',
  )
}
console.log('Toʻldiriş uchun: npm run entry (yoki faylni qoʻlda tahrirlang)')
