/**
 * Bakes data/*.yaml into a TypeScript module.  `npm run catalog`
 *
 * The directory's facts live in YAML and are read with `readFileSync` at
 * module load. That works everywhere this project is run — except the one
 * place it actually runs: a serverless function, whose bundle contains
 * JavaScript and nothing else. No `data/` directory is deployed, so
 * `loadCategories()` threw ENOENT the moment any endpoint imported the
 * catalogue, and every one of them answered 500.
 *
 * It was invisible because the pages that show this data are prerendered
 * in CI, where the files are right there. Only the routes a person hits
 * at runtime — the add form's vocabulary, submitting a place, reading
 * reviews — went through the function, and they were exactly the ones
 * reported broken.
 *
 * So the data becomes code at build time. Same approach as
 * scripts/build-schema.ts, and for the same reason: a bundler carries
 * what it can see being imported, and nothing else.
 */
import { writeFileSync } from 'node:fs'
import { loadBusinesses, loadCategories, loadCities, loadDistricts, publishedOnly } from '../lib/load'

const OUT = 'server/utils/catalog.generated.ts'

export function render(): string {
  const { businesses } = loadBusinesses()
  const data = {
    businesses: publishedOnly(businesses),
    categories: loadCategories(),
    districts: loadDistricts(),
    cities: loadCities(),
    pendingCount: businesses.filter((b) => b.status !== 'published').length,
  }
  // Deliberately not including the git dates: they change with history
  // rather than with data, which would make the drift test below fail on
  // every commit. The sitemap that needs them is prerendered in CI.
  return `/* eslint-disable */
/**
 * GENERATED FILE — do not edit.
 *
 * Produced from data/*.yaml by scripts/build-catalog.ts (\`npm run catalog\`).
 * Edit the YAML; server/utils/catalog.test.ts fails if this drifts.
 */
import type { Business, Category, City, District } from '../../lib/load'

export const CATALOG: {
  businesses: Business[]
  categories: Category[]
  districts: District[]
  cities: City[]
  pendingCount: number
} = ${JSON.stringify(data, null, 2)}
`
}

if (process.argv[1]?.endsWith('build-catalog.ts')) {
  const out = render()
  writeFileSync(OUT, out)
  console.log(`${OUT} — ${(out.length / 1024).toFixed(1)} KB`)
}
