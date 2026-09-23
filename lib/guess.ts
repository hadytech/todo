/**
 * Guessing a category from a place's name.
 *
 * Purely a convenience: it preselects a dropdown the person can change,
 * and a wrong guess costs one tap. It exists because most Uzbek business
 * names say what the business is — "Sartaroşxona", "Dorixona",
 * "Kafe" — so making someone pick from a list of twenty is asking them
 * to restate what they already typed.
 *
 * Matching runs over the ASCII fold, so the new alphabet, the official
 * one and Cyrillic all hit the same keywords.
 */
import { toAscii } from './alphabet'

/**
 * Order here is irrelevant — see `guessCategory`, which picks the
 * longest matching keyword rather than the first. That matters more
 * than it looks: "sartaroshxonasi" contains "oshxona", so a
 * first-match scan hands a barber to the restaurants.
 */
const RULES: [category: string, keywords: string[]][] = [
  ['ovqatlanish/choyxona', ['choyxona', 'chayxana', 'chaykhana']],
  ['ovqatlanish/qahvaxona', ['qahvaxona', 'kofe', 'coffee', 'kahvaxona']],
  ['ovqatlanish/fast-food', ['fast food', 'fastfood', 'burger', 'pizza', 'lavash', 'shaurma', 'shawarma', 'hot dog']],
  ['ovqatlanish/restoran', ['restoran', 'restaurant', 'milliy taomlar', 'osh markazi', 'oshxona']],
  ['ovqatlanish/kafe', ['kafe', 'cafe', 'kofeynya']],

  ['gozallik/sartaroshxona', ['sartaroshxona', 'sartarosh', 'barber', 'parikmaxer']],
  ['gozallik/manikyur', ['manikyur', 'manicure', 'nail']],
  ['gozallik/spa', ['spa', 'hammom', 'sauna']],
  ['gozallik/salon', ['gozallik saloni', 'beauty', 'salon']],

  ['sogliq/stomatologiya', ['stomatologiya', 'stomatolog', 'dental', 'tish shifokori', 'tish']],
  ['sogliq/dorixona', ['dorixona', 'apteka', 'pharmacy']],
  ['sogliq/laboratoriya', ['laboratoriya', 'lab ', 'analiz']],
  ['sogliq/klinika', ['klinika', 'clinic', 'shifoxona', 'med', 'tibbiyot markazi']],

  ['talim/universitet', ['universitet', 'university', 'institut', 'institute', 'akademiya', 'academy', 'konservatoriya']],
  ['talim/til-markazi', ['til markazi', 'language', 'ingliz tili', 'english']],
  ['talim/oquv-markaz', ['oquv markaz', 'oquv markazi', 'training', 'kurs', 'markaz']],
  ['talim/maktab', ['maktab', 'school', 'litsey', 'lyceum', 'gimnaziya']],

  ['savdo/kompyuter', ['kompyuter', 'computer', 'noutbuk', 'laptop', 'elektronika', 'electronics']],
  ['savdo/texnika', ['maishiy texnika', 'texnika', 'technika']],
  ['savdo/savdo-markazi', ['savdo markazi', 'mall', 'plaza', 'savdo majmuasi']],
  ['savdo/bozor', ['bozor', 'bazar', 'bazaar', 'rinok']],
]

/**
 * A category slug ("asosiy/ichki"), or null when the name says nothing.
 *
 * Null is a real answer here. Preselecting a plausible-looking wrong
 * category is worse than preselecting nothing, because a person
 * skimming a filled form tends to trust it.
 */
export function guessCategory(name: string): string | null {
  if (!name) return null
  const hay = ` ${toAscii(name).toLowerCase()} `

  // Longest match wins. Uzbek business names nest words inside each
  // other constantly — "sartaroshxona" contains "oshxona", "bozor"
  // turns up inside plenty of names that are not markets — and the
  // longer keyword is reliably the more specific claim.
  let best: { category: string; length: number } | null = null
  for (const [category, keywords] of RULES) {
    for (const k of keywords) {
      if (hay.includes(k) && (!best || k.length > best.length)) {
        best = { category, length: k.length }
      }
    }
  }
  return best?.category ?? null
}
