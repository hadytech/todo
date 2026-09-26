/**
 * The words a visitor actually reads.  `npm run check:uzbek`
 *
 * `npm run canonicalise` guards the whole repository, but only against
 * one thing: `oʻ`/`gʻ` left where `ö`/`ğ` belongs. It cannot look for
 * `ch`/`sh`, because this repository is full of English — `search`,
 * `fetch`, `schema`, `push` — and a blanket rule would drown in them.
 *
 * So `ishlamayapti`, `Birinchi` and `pocta` all shipped to the site in
 * the old alphabet, past a green check, for weeks.
 *
 * This looks at a much smaller surface where the rule is unambiguous:
 * the strings a person sees. Inside those, a lowercase `ch` or `sh` is
 * an error, and so is a Russian word with a perfectly good Uzbek one
 * beside it.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** Brand names keep their own spelling. They are not Uzbek words. */
const BRANDS = [
  'GitHub', 'Telegram', 'Instagram', 'Google', 'Yandex', '2GIS', 'OpenStreetMap',
  'Chrome', 'Safari', 'Firefox', 'Vercel', 'Neon', 'Postgres', 'MiniSearch',
  'Claude', 'Resend', 'Cloudflare',
]

/**
 * Russian where Uzbek exists.
 *
 * Not a purge of every borrowing — `telefon`, `sayt`, `spam` and
 * `reklama` have no everyday Uzbek equivalent and pretending otherwise
 * produces text nobody speaks. These are the ones that do.
 */
const RUSSIAN: Record<string, string> = {
  lenta: 'oqim',
  kategoriya: 'turkum / turi',
  filtr: 'tanlaş / saralaş',
  repozitoriya: 'ombor / manba kodi',
  analitika: 'tahlil',
  forma: 'yuboriş / sahifa',
  adres: 'manzil',
  rayon: 'tuman',
  magazin: 'dökon',
  sayt: '',
}
/** Entries with an empty replacement are allowed; listed to show they were considered. */
const ALLOWED_RUSSIAN = new Set(Object.entries(RUSSIAN).filter(([, v]) => !v).map(([k]) => k))

/** Old-alphabet spellings that a word list catches better than a pattern. */
const OLD_SPELLING = /(?<![A-Za-zöğçşÖĞÇŞʼ])[A-Za-zöğçşÖĞÇŞʼ]*(?:ch|sh)[A-Za-zöğçşÖĞÇŞʼ]*(?![A-Za-zöğçşÖĞÇŞʼ])/gi

/**
 * `hech`, not `hiç`.
 *
 * Uzbek is `hech`; `hiç` is Turkish. Easy to type and impossible to see
 * once it is everywhere, so it gets its own rule rather than relying on
 * anybody proofreading.
 */
const WRONG_WORDS: Record<string, string> = {
  'hiç': 'heç',
  'pocta': 'poçta',
  'karta': 'xarita',
  'papka': 'jild',
  'papkasini': 'jildini',
  'hiçqanday': 'heç qanday',
  'söro': 'sörov',
  'sörramaydi': 'söramaydi',
  'sörağmaydi': 'söramaydi',
  'slug': 'manzil',
  'bosh sahifa': 'boş sahifa',
}

/**
 * Word boundaries that work next to ö, ğ, ç and ş.
 *
 * JavaScript's `\b` is defined on ASCII word characters, so `\bhiç\b`
 * can never match: after `ç` — a non-word character to the regex engine —
 * a following space is also non-word, so there is no boundary and the
 * assertion fails. Every rule about a word containing a new letter was
 * silently dead, which is exactly the class of bug this file exists to
 * catch. Lookarounds over an explicit alphabet do work.
 */
const LETTER = 'A-Za-zöğçşÖĞÇŞʼ'
const word = (w: string, suffix = '') =>
  new RegExp(`(?<![${LETTER}])${w}${suffix}(?![${LETTER}])`, 'i')

interface Finding { file: string; text: string; problem: string }
const findings: Finding[] = []

/** Everything between the outermost <template> tags. */
function templateOf(source: string): string {
  const start = source.indexOf('<template>')
  const end = source.lastIndexOf('</template>')
  return start === -1 || end === -1 ? '' : source.slice(start + 10, end)
}

/**
 * Visible strings: text nodes, and the attributes that are read aloud or
 * shown. Bindings (`:placeholder="x"`) are skipped — their value is an
 * expression, and the literal it resolves to is checked wherever it is
 * written.
 */
function visibleStrings(file: string, source: string): string[] {
  const out: string[] = []

  if (file.endsWith('.vue')) {
    const tpl = templateOf(source)
      // Comments are for whoever reads the code.
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // <code> holds file names and literals, quoted deliberately. Same
      // reasoning as backticks in scripts/canonicalise.ts.
      .replace(/<code[^>]*>[\s\S]*?<\/code>/g, ' ')
    for (const m of tpl.matchAll(/(?:^|>)([^<>]+)(?:<|$)/g)) out.push(m[1]!)
    for (const m of tpl.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"{}]+)"/g)) {
      out.push(m[1]!)
    }
  }

  // Messages the server hands to a person, and page titles.
  for (const m of source.matchAll(/statusMessage: '([^']+)'/g)) out.push(m[1]!)
  for (const m of source.matchAll(/(?:title|content|label): '([^']+)'/g)) out.push(m[1]!)

  return out
    // Interpolations carry expressions, not prose.
    .map((s) => s.replace(/\{\{[^}]*\}\}/g, ' ').replace(/\$\{[^}]*\}/g, ' '))
    .map((s) => s.replace(/&[a-z]+;/g, ' ').trim())
    .filter((s) => s.length > 2 && /[a-zA-ZöğçşÖĞÇŞ]{3}/.test(s))
}

const files = execSync('git ls-files', { encoding: 'utf8' })
  .trim().split('\n')
  .filter((f) => /^(?:app|server)\/.*\.(?:vue|ts)$/.test(f))

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const text of visibleStrings(file, source)) {
    const withoutBrands = BRANDS.reduce((s, b) => s.replaceAll(b, ' '), text)

    for (const m of withoutBrands.matchAll(OLD_SPELLING)) {
      const found = m[0]
      /**
       * Capitalised words used to be skipped here, on the theory that
       * they were class names. They are also how every Uzbek sentence
       * begins, so `Hech narsa topilmadi` and `Birinchi bölib qöşing`
       * both sailed past. Only camelCase and SCREAMING_CASE are skipped
       * now — neither is a word anybody reads.
       */
      if (/[a-z][A-Z]/.test(found) || found === found.toUpperCase()) continue
      findings.push({ file, text, problem: `eski imlo: "${found}" — ch→ç, sh→ş` })
    }

    for (const [wrong, right] of Object.entries(WRONG_WORDS)) {
      if (word(wrong).test(withoutBrands)) {
        findings.push({ file, text, problem: `"${wrong}" → "${right}"` })
      }
    }

    for (const [ru, uz] of Object.entries(RUSSIAN)) {
      if (ALLOWED_RUSSIAN.has(ru)) continue
      if (word(ru, `[${LETTER}]*`).test(withoutBrands)) {
        findings.push({ file, text, problem: `rusça: "${ru}" → "${uz}"` })
      }
    }
  }
}

if (!findings.length) {
  console.log('Körinadigan matnlar toza.')
  process.exit(0)
}

let last = ''
for (const f of findings) {
  if (f.file !== last) { console.log(`\n${f.file}`); last = f.file }
  console.log(`   ${f.problem}\n     « ${f.text.slice(0, 90)} »`)
}
console.log(`\n${findings.length} ta muammo.`)
process.exit(1)
