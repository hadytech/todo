/**
 * The CI gate. Every pull request runs this, so malformed data cannot
 * reach the site — which is what makes "anyone can send a PR" safe.
 */
import { loadBusinesses } from '../lib/load'

const { businesses, issues } = loadBusinesses()
const errors = issues.filter((i) => i.level === 'error')
const warnings = issues.filter((i) => i.level === 'warning')

for (const w of warnings) console.warn(`  ogohlantirish  ${w.file}\n                 ${w.message}`)
for (const e of errors) console.error(`  XATO           ${e.file}\n                 ${e.message}`)

console.log(
  `\n${businesses.length} ta joy tekşirildi — ` +
  `${errors.length} xato, ${warnings.length} ogohlantirish.`,
)

process.exit(errors.length ? 1 : 0)
