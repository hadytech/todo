/**
 * The single source of truth for the alphabet question.
 *
 * Data in `data/` is authored in the NEW Uzbek Latin alphabet (ö ğ ç ş).
 * Everything else is derived from it:
 *
 *   toDisplay()        -> what the user sees          "Çorsu Restorani"
 *   toStandardLatin()  -> official orthography        "Chorsu Restorani"  (with oʻ/gʻ)
 *   toAscii()          -> SEO alt names, img alt      "Chorsu Restorani"
 *   toSlug()           -> URLs                        "chorsu-restorani"
 *   toSearchKey()      -> search index AND queries    "chorsu restorani"
 *
 * The rule: write in ö/ğ/ç/ş, search in anything, render in whatever wins.
 * `toSearchKey` must collapse new Latin, official Latin, bare ASCII and
 * Cyrillic onto one key, or search silently fails for most of the country.
 */

/** A letter that has a canonical new-Latin form. */
interface Letter {
  /** New Latin, as authored in data/. */
  canonical: string
  /** Official Uzbek Latin, using the okina U+02BB. */
  standard: string
  /** Slug- and SEO-safe ASCII. Note ç/ş expand to DIGRAPHS, not single letters. */
  ascii: string
  /** Every other spelling that must fold to the same search key. */
  variants: string[]
}

export const LETTERS: Letter[] = [
  {
    canonical: 'ö',
    standard: 'oʻ',
    ascii: 'o',
    // U+02BB okina (official), plus the typewriter/curly apostrophes people
    // actually type, plus both Cyrillic letters that land on this sound.
    variants: ['oʻ', "o'", 'o‘', 'o’', 'oʼ', 'o`', 'ō', 'ў', 'о', 'ө'],
  },
  {
    canonical: 'ğ',
    standard: 'gʻ',
    ascii: 'g',
    variants: ['gʻ', "g'", 'g‘', 'g’', 'gʼ', 'g`', 'ḡ', 'ғ', 'г'],
  },
  {
    canonical: 'ç',
    standard: 'ch',
    ascii: 'ch',
    variants: ['ch', 'ч'],
  },
  {
    canonical: 'ş',
    standard: 'sh',
    ascii: 'sh',
    variants: ['sh', 'ш', 'щ'],
  },
]

/**
 * Cyrillic -> ASCII, for search keys only. Uzbek Cyrillic conventions:
 * х = x (not h), ҳ = h, қ = q. The letters that overlap with LETTERS
 * (ў о ғ г ч ш щ) are handled there and deliberately omitted here.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ъ: '', ь: '',
  ы: 'i', э: 'e', ю: 'yu', я: 'ya', қ: 'q', ҳ: 'h',
}

/** Apostrophe-ish characters to drop once digraphs have been consumed. */
const APOSTROPHES = /[ʻʼ'‘’`´]/g

type Rule = [from: string, to: string]

/**
 * Build a longest-match-first rule list.
 *
 * Longest-first matters: without it "ch" is consumed as "c"+"h", and a
 * naive sequence of .replace() calls cascades (ç->ch, then ch->something).
 * A single left-to-right scan over a sorted table avoids both.
 */
function compile(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => b[0].length - a[0].length)
}

/** Everything -> slug/SEO ASCII. */
const TO_ASCII = compile([
  ...LETTERS.flatMap<Rule>((l) => [
    [l.canonical, l.ascii],
    [l.standard, l.ascii],
    ...l.variants.map<Rule>((v) => [v, l.ascii]),
  ]),
  ...Object.entries(CYRILLIC),
])

/** New Latin -> official Latin (oʻ, gʻ, ch, sh). */
const TO_STANDARD = compile(LETTERS.map<Rule>((l) => [l.canonical, l.standard]))

/**
 * Single-pass scanner. Preserves case: when the matched source text starts
 * uppercase, the replacement is title-cased — so "Ç" becomes "Ch", not "CH".
 */
function transliterate(input: string, rules: Rule[]): string {
  const src = input.normalize('NFC')
  // Uzbek's new alphabet adds only ö ğ ç ş — no dotless ı — so the
  // Turkish/Azeri toLowerCase() hazard does not apply here.
  const lower = src.toLowerCase()
  let out = ''

  outer: for (let i = 0; i < src.length; ) {
    for (const [from, to] of rules) {
      if (from && lower.startsWith(from, i)) {
        const matched = src.slice(i, i + from.length)
        const isUpper = matched !== matched.toLowerCase() && matched[0] === matched[0].toUpperCase()
        out += isUpper && to ? to[0].toUpperCase() + to.slice(1) : to
        i += from.length
        continue outer
      }
    }
    out += src[i]
    i += 1
  }

  return out
}

/** What the user sees. Data is already new Latin; just normalize. */
export function toDisplay(input: string): string {
  return input.normalize('NFC')
}

/** Official Uzbek Latin orthography, for `alternateName` and copy-paste. */
export function toStandardLatin(input: string): string {
  return transliterate(input, TO_STANDARD)
}

/** Plain ASCII, case preserved. Feeds JSON-LD alternateName and img alt text. */
export function toAscii(input: string): string {
  return transliterate(input, TO_ASCII).replace(APOSTROPHES, '')
}

/** URL slug: ASCII, lowercase, hyphen-separated. */
export function toSlug(input: string): string {
  return toAscii(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The fold that makes search work. Applied to indexed text AND to the
 * user's query, so every spelling of a name meets at the same key.
 */
export function toSearchKey(input: string): string {
  return toAscii(input)
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Warns when data looks authored in the old alphabet. A warning, not an
 * error: loanwords and brand names ("Fresh Line") legitimately contain
 * these sequences.
 */
export function findLegacySpellings(input: string): string[] {
  const hits = new Set<string>()
  for (const m of input.matchAll(/(?:o|g)(?:ʻ|ʼ|'|‘|’|`)|ch|sh/gi)) hits.add(m[0])
  return [...hits]
}
