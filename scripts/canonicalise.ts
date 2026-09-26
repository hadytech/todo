/**
 * One-off repair: fold authored `oʻ`/`gʻ` into `ö`/`ğ`.
 *
 * The project's contract is that everything a person writes — data,
 * interface strings, documentation — is in the new alphabet. That was
 * only half true: `ch`/`sh` were converted to `ç`/`ş` while `oʻ`/`gʻ`
 * were left as the official digraphs, producing `koʻçasi`, which is
 * neither alphabet.
 *
 * This file is not exempt from its own rule, which is why that example
 * is in backticks: the check found it the moment the file was committed
 * and `git ls-files` started reporting it.
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
 * Two exemptions.
 *
 * lib/alphabet.ts and its tests: their `oʻ`/`gʻ` literals are the
 * definition of the thing being converted, so rewriting them would delete
 * the mapping and quietly make every test vacuous.
 *
 * `*.generated.ts`: nobody writes these, and one of them deliberately
 * carries the official-Latin form of every listing — `Koʻkaldosh` — for
 * JSON-LD's alternateName. That spelling is the point of the field.
 * Rewriting it would corrupt derived data to satisfy a rule about prose.
 */
const EXEMPT = /^lib\/alphabet\.|\.generated\.ts$/

/**
 * Tracked files, plus untracked ones git is not ignoring.
 *
 * `git ls-files` alone lists only what is already committed, so a brand
 * new file is invisible to this check until after it lands — which is
 * exactly how a generated file reached CI with old spellings in it while
 * the same command passed locally. Adding `--others` means a file is
 * checked the moment it exists.
 */
const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .trim().split('\n')
  .filter(Boolean)
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
