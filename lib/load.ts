import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parse } from 'yaml'
import { businessSchema, categoriesSchema, districtsSchema, type BusinessInput } from './schema'
import { toAscii, toSlug, toSearchKey, toStandardLatin, findLegacySpellings } from './alphabet'

export const DATA_DIR = join(process.cwd(), 'data')

export interface Category { slug: string; name: string; icon?: string; children: { slug: string; name: string }[] }
export interface District { slug: string; name: string }

/** A validated business with every alphabet form derived. */
export interface Business extends BusinessInput {
  /** From the filename. Stable, reviewable, and the URL. */
  slug: string
  /** Official Latin, for JSON-LD alternateName. */
  nameStandard: string
  /** ASCII, for alternateName, img alt and anywhere a crawler folds diacritics. */
  nameAscii: string
  /** The fold that search runs against. */
  searchKey: string
  categoryTop: string
  categorySub: string
}

export interface Issue { file: string; message: string; level: 'error' | 'warning' }

function readYaml(path: string): unknown {
  return parse(readFileSync(path, 'utf8'))
}

export function loadCategories(): Category[] {
  return categoriesSchema.parse(readYaml(join(DATA_DIR, 'categories.yaml')))
}

export function loadDistricts(): District[] {
  return districtsSchema.parse(readYaml(join(DATA_DIR, 'districts.yaml')))
}

/**
 * Reads, validates and enriches every business file.
 *
 * Returns issues rather than throwing, so `npm run validate` can report
 * every problem in one pass instead of one per run — the difference
 * between a usable CI check and a frustrating one.
 */
export function loadBusinesses(): { businesses: Business[]; issues: Issue[] } {
  const dir = join(DATA_DIR, 'businesses')
  const issues: Issue[] = []
  const businesses: Business[] = []

  const categories = loadCategories()
  const districts = new Set(loadDistricts().map((d) => d.slug))
  const categoryPairs = new Set(
    categories.flatMap((c) => c.children.map((ch) => `${c.slug}/${ch.slug}`)),
  )

  if (!existsSync(dir)) return { businesses, issues }

  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))

  for (const file of files) {
    const slug = basename(file).replace(/\.ya?ml$/, '')
    const rel = `data/businesses/${file}`

    let raw: unknown
    try {
      raw = readYaml(join(dir, file))
    } catch (e) {
      issues.push({ file: rel, message: `YAML oʻqib boʻlmadi: ${(e as Error).message}`, level: 'error' })
      continue
    }

    const parsed = businessSchema.safeParse(raw)
    if (!parsed.success) {
      for (const err of parsed.error.errors) {
        issues.push({ file: rel, message: `${err.path.join('.') || '(root)'}: ${err.message}`, level: 'error' })
      }
      continue
    }
    const b = parsed.data

    if (slug !== toSlug(slug)) {
      issues.push({ file: rel, message: `fayl nomi slug boʻlsin: "${toSlug(slug)}.yaml"`, level: 'error' })
    }
    // A drifted filename silently changes the URL and drops the page's
    // accumulated SEO, so warn loudly but don't block a deliberate rename.
    const expected = toSlug(b.name)
    if (slug !== expected) {
      issues.push({
        file: rel,
        message: `fayl nomi nomga mos emas ("${expected}.yaml" kutilgandi) — ataylab boʻlsa, eʼtiborsiz qoldiring`,
        level: 'warning',
      })
    }
    if (!categoryPairs.has(b.category)) {
      issues.push({ file: rel, message: `notaʼnish kategoriya: "${b.category}"`, level: 'error' })
    }
    if (b.district && !districts.has(b.district)) {
      issues.push({ file: rel, message: `notaʼnish tuman: "${b.district}"`, level: 'error' })
    }
    for (const p of b.photos) {
      if (!existsSync(join(process.cwd(), 'public', 'photos', p.file))) {
        issues.push({ file: rel, message: `rasm topilmadi: public/photos/${p.file}`, level: 'error' })
      }
    }
    const legacy = findLegacySpellings(b.name)
    if (legacy.length) {
      issues.push({
        file: rel,
        message: `nom eski alifboda koʻrinadi (${legacy.join(', ')}) — yangi alifboda yozing (ö ğ ç ş); chet soʻz boʻlsa, eʼtiborsiz qoldiring`,
        level: 'warning',
      })
    }

    const [categoryTop, categorySub] = b.category.split('/')
    businesses.push({
      ...b,
      slug,
      nameStandard: toStandardLatin(b.name),
      nameAscii: toAscii(b.name),
      // Address and category feed the index too, so "yunusobod kafe" works
      // as a query without a separate filter.
      searchKey: toSearchKey([b.name, b.address ?? '', b.district ?? '', categorySub].join(' ')),
      categoryTop,
      categorySub,
    })
  }

  const seen = new Map<string, string>()
  for (const b of businesses) {
    const prev = seen.get(b.searchKey)
    if (prev) {
      issues.push({
        file: `data/businesses/${b.slug}.yaml`,
        message: `"${prev}" bilan bir xil koʻrinadi — takror boʻlishi mumkin`,
        level: 'warning',
      })
    }
    seen.set(b.searchKey, b.slug)
  }

  businesses.sort((a, b) => a.name.localeCompare(b.name))
  return { businesses, issues }
}

export function publishedOnly(businesses: Business[]): Business[] {
  return businesses.filter((b) => b.status === 'published')
}
