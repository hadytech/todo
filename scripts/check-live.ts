/**
 * Post-deploy smoke test.  `npm run check:live <base-url>`
 *
 * Everything else in this repo checks the build. This checks the thing
 * that actually serves — the gap where a correct build still reaches
 * nobody: a base URL that does not match where the site landed, a
 * canonical naming the wrong host, robots.txt opening a site that was
 * meant to stay private.
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 */
const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!base) {
  console.error('Foydalaniş: npm run check:live https://yalp.uz')
  process.exit(1)
}

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = []
const add = (name: string, ok: boolean, detail = '') => checks.push({ name, ok, detail })

async function get(path: string) {
  const res = await fetch(`${base}${path}`, { redirect: 'follow' })
  return { status: res.status, body: res.ok ? await res.text() : '', url: res.url }
}

/** The pages a visitor can actually land on. */
async function checkPages() {
  const home = await get('/')
  add('bosh sahifa yuklandi', home.status === 200, `HTTP ${home.status}`)
  if (home.status !== 200) return null

  // Follow a real link rather than guessing a slug — that also proves
  // internal links resolve under whatever base URL is in play.
  const link = home.body.match(/href="([^"]*\/b\/[^"]+)"/)?.[1]
  add('bosh sahifada joy havolasi bor', Boolean(link), link ?? 'topilmadi')
  if (!link) return home

  const path = link.startsWith('http') ? new URL(link).pathname : link
  const biz = await get(path)
  add('joy sahifasi yuklandi', biz.status === 200, `${path} → HTTP ${biz.status}`)

  if (biz.status === 200) {
    add('joy sahifasida JSON-LD bor', biz.body.includes('"@type":"LocalBusiness"'))
    const canonical = biz.body.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? ''
    add(
      'canonical şu domenni körsatadi',
      canonical.startsWith(base),
      canonical || 'canonical yöq',
    )
  }
  return home
}

/** Assets the page references must actually exist at those URLs. */
async function checkAssets(html: string) {
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|png|svg|avif))"/g)]
    .map((m) => m[1]!)
    .slice(0, 6)

  add('sahifa asset havolalari bor', refs.length > 0, `${refs.length} ta tekşiriladi`)

  for (const ref of refs) {
    const res = await fetch(`${base}${ref}`, { method: 'HEAD' })
    // A 404 here is the classic base-URL mismatch: the HTML builds one
    // prefix while the site is served from another.
    add(`asset yuklandi: ${ref}`, res.ok, `HTTP ${res.status}`)
  }
}

async function checkRobots(expectIndexable: boolean) {
  const res = await get('/robots.txt')
  add('robots.txt yuklandi', res.status === 200, `HTTP ${res.status}`)
  if (res.status !== 200) return

  const disallowed = /Disallow:\s*\/\s*$/m.test(res.body)
  add(
    expectIndexable ? 'robots.txt indekslaşga ruxsat beradi' : 'robots.txt indekslaşni tösadi',
    expectIndexable ? !disallowed : disallowed,
    res.body.trim().split('\n').join(' | '),
  )
}

async function checkSitemap() {
  const res = await get('/sitemap.xml')
  add('sitemap.xml yuklandi', res.status === 200, `HTTP ${res.status}`)
  if (res.status !== 200) return

  const locs = [...res.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!)
  add('sitemapda havolalar bor', locs.length > 0, `${locs.length} ta`)
  add(
    'sitemap şu domenni körsatadi',
    locs.every((l) => l.startsWith(base)),
    locs.find((l) => !l.startsWith(base)) ?? 'hammasi töğri',
  )
}

async function checkSearchIndex() {
  const res = await get('/search-index.json')
  add('qidiruv indeksi yuklandi', res.status === 200, `HTTP ${res.status}`)
  if (res.status === 200) {
    try {
      const parsed = JSON.parse(res.body)
      add('qidiruv indeksi öqildi', typeof parsed === 'object' && parsed !== null)
    } catch {
      add('qidiruv indeksi öqildi', false, 'JSON buzuq')
    }
  }
}

/**
 * HTTPS, checked rather than assumed.
 *
 * A directory people are meant to trust with addresses and phone numbers
 * cannot be served over plain http, and browsers now label it "Not
 * Secure" in the address bar. GitHub Pages issues the certificate
 * automatically once DNS resolves, but "Enforce HTTPS" is a separate
 * switch that has to be turned on — so the failure mode is a site that
 * works perfectly and quietly stays insecure.
 */
async function checkHttps() {
  if (!base.startsWith('https://')) {
    add('https', false, `${base} — https:// manzilini tekşiring`)
    return
  }

  const res = await fetch(base, { redirect: 'follow' })
  add('https ustidan işlaydi', res.ok && res.url.startsWith('https://'), res.url)

  // http:// must not simply serve: it has to redirect, or every link
  // shared over http stays on http forever.
  const insecure = base.replace(/^https:/, 'http:')
  try {
    const plain = await fetch(insecure, { redirect: 'follow' })
    add(
      'http https ga yönaltiradi',
      plain.url.startsWith('https://'),
      plain.url.startsWith('https://') ? 'yönaltirildi' : `http'da qoldi: ${plain.url}`,
    )
  } catch (e) {
    add('http https ga yönaltiradi', false, (e as Error).message)
  }
}

const expectIndexable = process.env.EXPECT_INDEXABLE === 'true'

await checkHttps()
const home = await checkPages()
if (home) await checkAssets(home.body)
await checkRobots(expectIndexable)
await checkSitemap()
await checkSearchIndex()

console.log(`\n${base}\n`)
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'XATO'}  ${c.name.padEnd(40)} ${c.detail}`)
}

const failed = checks.filter((c) => !c.ok)
console.log(failed.length ? `\n${failed.length} ta tekşiruv ötmadi.` : '\nSayt işlayapti.')
process.exit(failed.length ? 1 : 0)
