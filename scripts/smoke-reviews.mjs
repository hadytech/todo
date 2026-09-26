/**
 * Rate a place and say why, with no account, in a real browser.
 * `npm run smoke:reviews`
 *
 * This is the one flow the site exists for, and it is the one that cannot
 * be covered from below. The database tests prove the constraints; the
 * unit tests prove the arithmetic. Neither can see whether the form is
 * reachable without signing in, whether the cookie the server mints comes
 * back on the next request, or whether a person who has just written
 * something sees it appear.
 *
 * Needs a Postgres and a server build:
 *
 *   NITRO_PRESET=node-server npm run build
 *   DATABASE_URL=postgres://… npm run smoke:reviews
 *
 * Skips cleanly with no DATABASE_URL, the same way the database tests do,
 * so `npm test` stays runnable with nothing installed.
 */
import { chromium } from 'playwright'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * `TEST_DATABASE_URL`, not `DATABASE_URL`, and deliberately so: this
 * script empties the tables it uses before it starts, and a script that
 * truncates must not be able to read a production connection string out
 * of the environment by accident. Same variable the database tests use.
 */
const url = process.env.TEST_DATABASE_URL
if (!url) {
  console.log('\nTEST_DATABASE_URL yöq — şarh sinovi ötkazib yuborildi.\n')
  process.exit(0)
}
if (!existsSync('.output/server/index.mjs')) {
  console.error('\n.output/server/index.mjs yöq. Avval: NITRO_PRESET=node-server npm run build\n')
  process.exit(1)
}

const PORT = 4198
const ORIGIN = `http://127.0.0.1:${PORT}`
/** A published listing, so the endpoint's catalogue check passes. */
const SLUG = 'chorsu-bozori'

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

// Self-contained: apply the schema (safe to re-run) and empty the tables,
// so this can be pointed at a blank database and just work.
execFileSync('psql', ['-q', '-v', 'ON_ERROR_STOP=1', url, '-f', 'db/schema.sql'], {
  encoding: 'utf8',
  stdio: ['ignore', 'ignore', 'pipe'],
})
execFileSync('psql', [
  '-q', '-v', 'ON_ERROR_STOP=1', url,
  '-c', 'truncate reviews, votes, users, submissions, login_tokens cascade',
], { encoding: 'utf8' })

const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  env: {
    ...process.env,
    DATABASE_URL: url,
    PORT: String(PORT),
    NITRO_PORT: String(PORT),
    HOST: '127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const serverLog = []
server.stdout.on('data', (d) => serverLog.push(String(d)))
server.stderr.on('data', (d) => serverLog.push(String(d)))

const stop = () => { server.kill('SIGTERM') }
process.on('exit', stop)

// Wait for it to answer rather than sleeping a guessed interval.
const deadline = Date.now() + 30_000
let up = false
while (Date.now() < deadline && !up) {
  up = await fetch(`${ORIGIN}/api/facets`).then((r) => r.ok).catch(() => false)
  if (!up) await new Promise((r) => setTimeout(r, 300))
}
if (!up) {
  console.error(`Server kötarilmadi:\n${serverLog.join('')}`)
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 390, height: 840 } })
const page = await ctx.newPage()
const pageErrors = []
const cspViolations = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  const t = m.text()
  // A blocked resource reports itself here and nowhere else. A CSP that
  // quietly breaks the map is the classic way this file earns its keep.
  if (/Content Security Policy|Refused to/i.test(t)) cspViolations.push(t)
})

const body = 'Meva-sabzavot arzon, ertalab borsangiz tanlov köp böladi.'

console.log('\nHisobsiz şarh yoziş:\n')

// ---------------------------------------------------------------- headers
const head = await fetch(`${ORIGIN}/b/${SLUG}`)
const csp = head.headers.get('content-security-policy') ?? ''
check('CSP is sent', csp.includes("default-src 'self'"), csp.slice(0, 40))
check('the page cannot be framed', csp.includes("frame-ancestors 'none'"))
check('forms cannot post elsewhere', csp.includes("form-action 'self'"))
check('MIME sniffing is off', head.headers.get('x-content-type-options') === 'nosniff')
check('referrers are trimmed',
  (head.headers.get('referrer-policy') ?? '').includes('strict-origin'))

// --------------------------------------------------- reading sets no cookie
const read = await fetch(`${ORIGIN}/api/reviews/${SLUG}`)
check('reading is enabled', (await read.clone().json()).enabled === true)
check('reading alone mints no cookie',
  !(read.headers.get('set-cookie') ?? '').includes('yalp_author'),
  read.headers.get('set-cookie') ?? 'none')

// ------------------------------------------------------------ cross-site POST
const cross = await fetch(`${ORIGIN}/api/reviews`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  body: JSON.stringify({ slug: SLUG, rating: 1, body: body }),
})
check('a POST from another origin is refused', cross.status === 403, `status ${cross.status}`)

// ----------------------------------------------------------------- the form
await page.goto(`${ORIGIN}/b/${SLUG}`, { waitUntil: 'networkidle' })

const openForm = page.getByRole('button', { name: /haqida yoziş/i })
check('writing is offered without signing in', await openForm.count() > 0)
check('no login wall', await page.getByRole('link', { name: /kiriş va şarh/i }).count() === 0)

await openForm.first().click()
await page.waitForTimeout(300)

// Five stars: the control is a radio group, so pick the last one.
const stars = page.locator('form input[type=radio]')
check('the rating control is there', await stars.count() === 5, `${await stars.count()} yulduz`)
await stars.nth(4).check({ force: true })

await page.locator('form textarea').fill(body)
await page.locator('form input[type=text], form input:not([type])').first().fill('Dilnoza')

const privacy = page.locator('form a[href="/maxfiylik"]')
check('the form says what happens to your address', await privacy.count() > 0)

const submit = page.locator('form button[type=submit]')
check('submit is enabled once there is a rating and a sentence', await submit.isEnabled())
await submit.click()
await page.waitForTimeout(1500)

// ------------------------------------------------------------- it landed
const cookies = await ctx.cookies()
const author = cookies.find((c) => c.name === 'yalp_author')
check('writing mints an author cookie', Boolean(author))
check('the cookie is httpOnly', author?.httpOnly === true)
check('the cookie is same-site Lax', /lax/i.test(author?.sameSite ?? ''))
// Secure in production, which is why the calls below go through the page:
// an http API context will not send it.
check('the cookie is Secure in a production build',
  author?.secure === (process.env.NODE_ENV !== 'development'),
  `secure=${author?.secure}`)

const shown = page.locator('ol li')
check('the review is on the page', await shown.count() >= 1, `${await shown.count()} ta`)
check('it carries the name that was typed',
  (await page.locator('ol li').first().innerText()).includes('Dilnoza'))
check('an unverified name is labelled as one',
  await page.getByTitle(/tasdiqlanmagan/).count() > 0)
check('the text is there', (await page.locator('ol li').first().innerText()).includes('arzon'))
// Not the average: the site withholds it until there are enough reviews
// to mean something, which is deliberate and is tested in lib/rating.
check('the count appears', await page.getByText(/1 ta şarh/).count() > 0)

// ----------------------------------------------------- it is mine on return
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check('on return it is recognised as mine',
  await page.getByRole('button', { name: /şarhimni tahrirlaş/i }).count() > 0)
check('voting on your own review is not offered',
  await page.locator('ol li button[aria-label^="Foydali —"]').first().isDisabled())

// ------------------------------------------------------ one per place, not two
//
// Driven through the page rather than Playwright's APIRequestContext: the
// author cookie is `Secure`, and an API context talking http does not send
// it — so every call looked like a brand new anonymous writer and the
// uniqueness rule appeared to be broken when it was not. A fetch from the
// page is also what a real visitor's browser does.
const asPage = (p, method, path, body) => p.evaluate(
  ([method, path, body]) => fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) })),
  [method, path, body],
)

const second = await asPage(page, 'POST', '/api/reviews', {
  slug: SLUG, rating: 1, body: 'Boşqa fikr, lekin ayni şu joy haqida yana.',
})
check('a second review replaces the first', second.status === 200, `status ${second.status}`)
const after = (await asPage(page, 'GET', `/api/reviews/${SLUG}`)).json
check('there is still only one', after.count === 1, `${after.count} ta`)
check('and it is the new one', after.reviews[0]?.rating === 1)

// ----------------------------------------------------------------- withdraw
const gone = await asPage(page, 'DELETE', `/api/reviews?slug=${SLUG}`)
check('it can be withdrawn', gone.status === 200, `status ${gone.status}`)
const empty = (await asPage(page, 'GET', `/api/reviews/${SLUG}`)).json
check('and it is gone', empty.count === 0)

// -------------------------------------------------- somebody else may vote
const other = await browser.newContext()
const otherPage = await other.newPage()
await otherPage.goto(`${ORIGIN}/b/${SLUG}`, { waitUntil: 'domcontentloaded' })
await asPage(otherPage, 'POST', '/api/reviews', { slug: SLUG, rating: 4, body })

const theirs = (await asPage(page, 'GET', `/api/reviews/${SLUG}`)).json
const reviewId = theirs.reviews[0]?.id
check('a review by another guest is visible', Boolean(reviewId))

const voted = await asPage(page, 'POST', '/api/reviews/vote', { reviewId, value: 1 })
check('another guest can vote on it', voted.status === 200, `status ${voted.status}`)
check('the vote is counted', voted.json?.up === 1)

const ownVote = await asPage(otherPage, 'POST', '/api/reviews/vote', { reviewId, value: 1 })
check('its author cannot vote on it', ownVote.status === 403, `status ${ownVote.status}`)
await other.close()

// =================================================== adding a place, no account
//
// The other half of "available for everyone". The photo carries a GPS tag
// on purpose: a shopfront taken on a phone does, and the point of the
// server-side strip is that it does not survive being stored.
console.log('\nHisobsiz joy qöşiş:\n')

/** A tiny but real JPEG with an Exif block holding a GPS IFD tag. */
function jpegWithGps() {
  const seg = (marker, payload) => {
    const n = payload.length + 2
    return [0xff, marker, (n >> 8) & 0xff, n & 0xff, ...payload]
  }
  const ascii = (t) => [...t].map((c) => c.charCodeAt(0))
  const exif = seg(0xe1, [...ascii('Exif'), 0, 0, ...ascii('MM'), 0x00, 0x2a, 0, 0, 0, 8, 0x88, 0x25])
  const dqt = seg(0xdb, [0x00, ...Array.from({ length: 64 }, () => 0x10)])
  const sof = seg(0xc0, [0x08, 0, 16, 0, 16, 1, 0x11, 0x00])
  const sos = seg(0xda, [0x01, 0x00, 0x00, 0x00, 0x3f, 0x00])
  return Buffer.from([0xff, 0xd8, ...exif, ...dqt, ...sof, ...sos, 0x12, 0x34, 0x56, 0xff, 0xd9])
}

/** A real pair from data/categories.yaml — the endpoint checks it exists. */
const CATEGORY = 'ovqatlanish/qahvaxona'

const dirty = jpegWithGps()
check('the fixture really does carry Exif', dirty.includes(Buffer.from('Exif')))

await page.goto(`${ORIGIN}/qoshish`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
// Everything below the first field is hidden until there is a name. That
// is the form's own design, tested in scripts/smoke.mjs.
await page.locator('input').first().fill('Registon qahvaxonasi')
await page.waitForTimeout(400)
const submitLabel = (await page.locator('form button[type=submit]').innerText()).trim()
check('the form posts to the server when there is one',
  !/telegram|github/i.test(submitLabel), `label: "${submitLabel}"`)
check('it says no account is needed',
  await page.getByText(/Hisob kerak emas/).count() > 0)
check('it links the privacy page', await page.locator('a[href="/maxfiylik"]').count() > 0)

const posted = await asPage(page, 'POST', '/api/submissions', {
  name: 'Registon qahvaxonasi',
  category: CATEGORY,
  lat: 41.31,
  lng: 69.28,
  rating: 5,
  comment: 'Ertalabki non hali issiq.',
  photo: `data:image/jpeg;base64,${dirty.toString('base64')}`,
})
check('a place can be added with no account', posted.status === 200, `status ${posted.status}`)

const stored = execFileSync('psql', [
  '-t', '-A', url,
  '-c', "select coalesce(photo,'') || '|' || coalesce(submitter_key,'') || '|' || coalesce(lat::text,'')"
      + ' from submissions order by created_at desc limit 1',
], { encoding: 'utf8' }).trim()
const [storedPhoto, storedKey, storedLat] = stored.split('|')

check('the pin was kept', storedLat.startsWith('41.31'), storedLat)
check('the photo was kept', storedPhoto.startsWith('data:image/jpeg;base64,'))
check('the Exif block did not survive storage',
  !Buffer.from(storedPhoto.split(',')[1] ?? '', 'base64').includes(Buffer.from('Exif')))
check('no address was stored, only a daily pseudonym',
  /^[0-9a-f]{32}$/.test(storedKey), storedKey)

const notAnImage = await asPage(page, 'POST', '/api/submissions', {
  name: 'Yolğon rasm',
  category: CATEGORY,
  photo: `data:image/jpeg;base64,${Buffer.from('<!doctype html><script>alert(1)</script>').toString('base64')}`,
})
check('a payload pretending to be a photo is refused',
  notAnImage.status === 400, `status ${notAnImage.status}`)

const crossSubmit = await fetch(`${ORIGIN}/api/submissions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  body: JSON.stringify({ name: 'Boşqa sayt', category: CATEGORY }),
})
check('a submission from another origin is refused',
  crossSubmit.status === 403, `status ${crossSubmit.status}`)

// --------------------------------------------------------- nothing was broken
check('no page errors', pageErrors.length === 0, pageErrors.join('; '))
check('nothing was blocked by the CSP', cspViolations.length === 0, cspViolations.join('; '))

await browser.close()
stop()

console.log(failures.length ? `\n${failures.length} ta muammo.\n` : '\nHammasi işlayapti.\n')
process.exit(failures.length ? 1 : 0)
