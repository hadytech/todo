/**
 * Performance budget gate.
 *
 * A budget nobody measures is a wish. This walks every prerendered page,
 * sums the gzipped weight of the scripts that page actually loads, and
 * fails the build if any page exceeds its limit.
 *
 * It counts only eagerly-loaded scripts — chunks reached through a
 * dynamic import (MapLibre, MiniSearch) are the point of the design and
 * are reported separately rather than charged to the page.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const ROOT = join(process.cwd(), '.output', 'public')

/** Gzipped KB of eagerly-loaded JS per page. */
const BUDGET_KB = 100
/** Gzipped KB of the initial HTML document. */
const HTML_BUDGET_KB = 40

if (!existsSync(ROOT)) {
  console.error('.output/public topilmadi — avval `npm run generate`.')
  process.exit(1)
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const gzipKb = (buf: Buffer | string) => gzipSync(buf).length / 1024

/**
 * Maps a URL from the HTML back to a file on disk.
 *
 * Under a project-site base URL the page asks for "/todo/_nuxt/x.js"
 * while the file sits at "_nuxt/x.js", so leading segments are dropped
 * until something matches. Resolving only the literal path made every
 * page measure as 0 KB and still print "ok" — a budget gate that passes
 * because it found nothing is worse than no gate.
 */
function resolve(ref: string): string | null {
  const parts = ref.replace(/^\//, '').split('/')
  for (let i = 0; i < parts.length; i++) {
    const candidate = join(ROOT, ...parts.slice(i))
    if (existsSync(candidate)) return candidate
  }
  return null
}

const pages = walk(ROOT).filter((f) => f.endsWith('.html'))
let failed = false

console.log(`Sahifa byudjeti: JS ≤ ${BUDGET_KB} KB, HTML ≤ ${HTML_BUDGET_KB} KB (gzip)\n`)

for (const page of pages) {
  const html = readFileSync(page, 'utf8')
  const route = '/' + relative(ROOT, page).replace(/(^|\/)index\.html$/, '') || '/'

  // Both <script src> and <link rel=modulepreload|preload as=script>
  // cost the visitor a download before the page is interactive.
  const refs = new Set<string>()
  for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) refs.add(m[1])
  for (const m of html.matchAll(/<link[^>]+href="([^"]+\.js)"[^>]*>/g)) {
    if (/rel="(modulepreload|preload)"/.test(m[0])) refs.add(m[1])
  }

  let jsKb = 0
  const missing: string[] = []
  for (const ref of refs) {
    const file = resolve(ref)
    if (!file) { missing.push(ref); continue }
    jsKb += gzipKb(readFileSync(file))
  }

  const htmlKb = gzipKb(html)
  const jsOver = jsKb > BUDGET_KB
  const htmlOver = htmlKb > HTML_BUDGET_KB
  if (jsOver || htmlOver || missing.length) failed = true

  const mark = jsOver || htmlOver || missing.length ? 'XATO ' : '  ok '
  console.log(
    `${mark} ${route.padEnd(42)} JS ${jsKb.toFixed(1).padStart(6)} KB   ` +
    `HTML ${htmlKb.toFixed(1).padStart(5)} KB`,
  )
  for (const m of missing) console.error(`       yöq fayl: ${m}`)
}

// Report the deliberately-lazy chunks so a regression that makes one of
// them eager is visible, rather than just showing up as a budget failure
// with no explanation.
const lazy = walk(join(ROOT, '_nuxt'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: relative(ROOT, f), kb: gzipKb(readFileSync(f)), body: readFileSync(f, 'utf8') }))
  .filter((c) => /maplibre|MiniSearch/.test(c.body))
  .sort((a, b) => b.kb - a.kb)

if (lazy.length) {
  console.log('\nKerak bölganda yuklanadigan bölaklar (sahifa byudjetiga kirmaydi):')
  for (const c of lazy.slice(0, 4)) console.log(`       ${c.kb.toFixed(1).padStart(6)} KB  ${c.name}`)
}

console.log(failed ? '\nByudjet buzildi.' : '\nByudjet saqlandi.')
process.exit(failed ? 1 : 0)
