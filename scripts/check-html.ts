/**
 * Static HTML audit over the generated site.
 *
 * Deliberately not a browser run: axe in CI means installing Chromium on
 * every pull request. These are the mechanical faults that don't need a
 * renderer, and they cover most of what has actually gone wrong here —
 * including the whitespace-collapse bug that shipped twice, where a
 * literal space between an interpolation and a tag vanishes and two
 * words run together.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), '.output', 'public')

if (!existsSync(ROOT)) {
  console.error('.output/public topilmadi — avval `npm run generate`.')
  process.exit(1)
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const f = join(dir, e)
    return statSync(f).isDirectory() ? walk(f) : [f]
  })
}

interface Problem { route: string; rule: string; detail: string }
const problems: Problem[] = []
const add = (route: string, rule: string, detail: string) => problems.push({ route, rule, detail })

/**
 * Visible text of an HTML fragment. Script and style bodies are dropped
 * first — their contents are not text, and inlined config JSON is full of
 * camelCase that would trip the run-together check.
 */
const strip = (html: string) => html
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&[a-z]+;|&#\d+;/gi, ' ')
  .trim()

// 200.html and 404.html are Nuxt's SPA fallback shells: empty bodies that
// hydrate client-side. They have no content to audit.
const SHELLS = new Set(['200.html', '404.html'])

for (const file of walk(ROOT).filter((f) => f.endsWith('.html'))) {
  if (SHELLS.has(relative(ROOT, file))) continue
  const html = readFileSync(file, 'utf8')
  const route = '/' + relative(ROOT, file).replace(/(^|\/)index\.html$/, '')

  if (!/<html[^>]+lang=/.test(html)) add(route, 'lang', '<html> has no lang attribute')

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
  if (!title?.trim()) add(route, 'title', 'no <title>')

  if (!/<meta name="description"/.test(html) && !/name="robots"[^>]*noindex/.test(html)) {
    add(route, 'description', 'indexable page with no meta description')
  }

  for (const img of html.match(/<img[^>]*>/g) ?? []) {
    if (!/\salt=/.test(img)) add(route, 'img-alt', img.slice(0, 70))
  }

  for (const input of html.match(/<input[^>]*>/g) ?? []) {
    const type = input.match(/type="([^"]+)"/)?.[1]
    if (type === 'hidden' || type === 'submit') continue
    if (!/aria-label=|aria-labelledby=|\bid="/.test(input)) {
      add(route, 'input-label', input.slice(0, 70))
    }
  }

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!)
  for (const id of new Set(ids)) {
    if (ids.filter((x) => x === id).length > 1) add(route, 'duplicate-id', id)
  }

  for (const a of html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? []) {
    if (!strip(a) && !/aria-label=/.test(a)) add(route, 'empty-link', a.slice(0, 70))
  }

  const headings = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
  if (headings.length && headings[0] !== 1) add(route, 'heading-order', `first heading is h${headings[0]}`)
  if (headings.filter((h) => h === 1).length > 1) add(route, 'heading-order', 'more than one h1')
  for (let i = 1; i < headings.length; i++) {
    if (headings[i]! > headings[i - 1]! + 1) {
      add(route, 'heading-order', `h${headings[i - 1]} followed by h${headings[i]}`)
    }
  }

  /**
   * Two words fused with no space — the signature of a literal space
   * collapsed between adjacent elements, which has shipped twice:
   * "yuboringyokixabar" and "Çilonzor2".
   *
   * Only the detectable halves of that bug: a word running into a capital
   * or into a digit. Two lowercase words fusing is indistinguishable from
   * an ordinary long word, so it stays a job for looking at the page.
   */
  const text = strip(html.slice(html.indexOf('<body')))
  for (const m of text.matchAll(/\b\p{Ll}{3,}(?:\p{Lu}\p{Ll}{2,}|\d)/gu)) {
    add(route, 'run-together', m[0].slice(0, 40))
  }
}

const byRule = new Map<string, Problem[]>()
for (const p of problems) byRule.set(p.rule, [...(byRule.get(p.rule) ?? []), p])

for (const [rule, list] of byRule) {
  console.log(`\n${rule}  (${list.length})`)
  for (const p of list.slice(0, 8)) console.log(`   ${p.route.padEnd(40)} ${p.detail}`)
  if (list.length > 8) console.log(`   … va yana ${list.length - 8} ta`)
}

console.log(problems.length ? `\n${problems.length} ta muammo topildi.` : '\nHTML tekşiruvi toza.')
process.exit(problems.length ? 1 : 0)
