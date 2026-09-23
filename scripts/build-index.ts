/**
 * Builds the static search index shipped to the browser.
 *
 * Runs before `nuxt generate`. Output is lazy-loaded on the first
 * keystroke, never on page load — search must not cost anything to
 * visitors who only came to read one business page.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import MiniSearch from 'minisearch'
import { loadBusinesses, loadCategories, loadDistricts, publishedOnly } from '../lib/load'
import { searchOptions, type IndexedBusiness } from '../lib/search'
import { synonymsFor } from '../lib/synonyms'

const { businesses, issues } = loadBusinesses()
const errors = issues.filter((i) => i.level === 'error')
if (errors.length) {
  console.error('Indeks qurilmadi — avval `npm run validate` xatolarini tuzating.')
  for (const e of errors) console.error(`  ${e.file}: ${e.message}`)
  process.exit(1)
}

const categoryNames = new Map(
  loadCategories().flatMap((c) => c.children.map((ch) => [`${c.slug}/${ch.slug}`, `${c.name} ${ch.name}`])),
)
const districtNames = new Map(loadDistricts().map((d) => [d.slug, d.name]))

const docs: IndexedBusiness[] = publishedOnly(businesses).map((b) => ({
  id: b.slug,
  name: b.name,
  address: b.address,
  category: categoryNames.get(b.category) ?? b.category,
  district: districtNames.get(b.district) ?? b.district,
  terms: synonymsFor(b.category).join(' '),
  lat: b.location.lat,
  lng: b.location.lng,
  price: b.price,
}))

const mini = new MiniSearch(searchOptions)
mini.addAll(docs)

const out = join(process.cwd(), 'public')
mkdirSync(out, { recursive: true })
const json = JSON.stringify(mini)
writeFileSync(join(out, 'search-index.json'), json)

const kb = (json.length / 1024).toFixed(1)
console.log(`Indeks tayyor: ${docs.length} ta joy, ${kb} KB (gzip ~3x kiçik).`)

// The index is downloaded by real users on real mobile networks. Catch
// the growth here rather than in a bug report.
if (json.length > 2_000_000) {
  console.warn(`\n  Ogohlantirish: indeks ${kb} KB — kategoriya böyicha bölişni öylang.`)
}
