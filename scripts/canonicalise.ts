/**
 * One-off repair: fold authored `oʻ`/`gʻ` into `ö`/`ğ`.
 *
 * The project's contract is that everything a person writes — data,
 * interface strings, documentation — is in the new alphabet. That was
 * only half true: `ch`/`sh` were converted to `ç`/`ş` while `oʻ`/`gʻ`
 * were left as the official digraphs, producing "koʻçasi", which is
 * neither alphabet.
 *
 * Kept in the repository rather than run and thrown away, because the
 * same drift can happen again the moment someone pastes an address from
 * a government site.
 *
 *   npm run canonicalise          # report only
 *   npm run canonicalise -- --fix # rewrite
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { toCanonical, findOfficialSpellings } from '../lib/alphabet'

const fix = process.argv.includes('--fix')

/**
 * lib/alphabet.ts and its tests are exempt: their `oʻ`/`gʻ` literals are
 * the definition of the thing being converted, so rewriting them would
 * delete the mapping and quietly make every test vacuous.
 */
const EXEMPT = /^lib\/alphabet\./

const files = execSync('git ls-files', { encoding: 'utf8' })
  .trim().split('\n')
  .filter((f) => /\.(yaml|yml|vue|ts|md|sh)$/.test(f))
  .filter((f) => !EXEMPT.test(f))

/**
 * A spelling inside backticks is a quotation, not prose.
 *
 * Documentation has to be able to say that `koʻçasi` was wrong without
 * the tool silently correcting the example and making the sentence
 * meaningless. Backticks are already how both Markdown and code
 * comments quote a literal, so this needs no new convention — and it is
 * the same reason lib/alphabet.ts is exempt wholesale.
 */
function outsideBackticks(text: string, f: (part: string) => string): string {
  return text.split(/(`[^`\n]*`)/g)
    .map((part) => (part.startsWith('`') && part.endsWith('`') && part.length > 1 ? part : f(part)))
    .join('')
}

let touched = 0
for (const file of files) {
  const before = readFileSync(file, 'utf8')

  const found: string[] = []
  outsideBackticks(before, (part) => { found.push(...findOfficialSpellings(part)); return part })
  if (!found.length) continue

  const unique = [...new Set(found)]
  touched += 1
  console.log(`${file}\n   ${unique.slice(0, 6).join(', ')}${unique.length > 6 ? ' …' : ''}`)
  if (fix) writeFileSync(file, outsideBackticks(before, (p) => toCanonical(p)), 'utf8')
}

if (!touched) {
  console.log('Hammasi yangi alifboda.')
} else if (fix) {
  console.log(`\n${touched} fayl tuzatildi.`)
} else {
  console.log(`\n${touched} faylda eski imlo bor. Tuzatiş: npm run canonicalise -- --fix`)
  process.exit(1)
}
