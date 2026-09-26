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

/**
 * A completely blank database, on purpose.
 *
 * The schema is NOT applied here. The server applies it itself on first
 * use (server/utils/migrate.ts), and that is the thing this most needs to
 * prove: connecting a database is the whole setup, with no second step on
 * anybody's laptop. If the migration does not happen, every check below
 * fails on a missing table.
 */
execFileSync('psql', [
  '-q', '-v', 'ON_ERROR_STOP=1', url,
  '-c', 'drop schema public cascade; create schema public',
], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] })

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

console.log('\nÖzini-özi sozlaş — boş bazada:\n')

const tables = () => execFileSync('psql', ['-t', '-A', url, '-c',
  "select count(*) from information_schema.tables where table_schema = 'public'",
], { encoding: 'utf8' }).trim()

check('the database really did start empty', tables() === '0', `${tables()} jadval`)

// One request to the endpoint the interface branches on. Nothing else.
const me = await (await fetch(`${ORIGIN}/api/auth/me`)).json()
check('the write side reports itself enabled', me.enabled === true, JSON.stringify(me))
check('the schema applied itself on first use', Number(tables()) > 5, `${tables()} jadval`)

const digest = execFileSync('psql', ['-t', '-A', url, '-c',
  'select digest from schema_state where id = 1',
], { encoding: 'utf8' }).trim()
check('the applied version was recorded', /^[0-9a-f]{64}$/.test(digest), digest.slice(0, 12))

// Idempotence across instances: a second call must not re-run the DDL or
// trip over its own `create index if not exists`.
const again = await Promise.all(
  Array.from({ length: 4 }, () => fetch(`${ORIGIN}/api/auth/me`).then((r) => r.status)),
)
check('concurrent callers do not collide', again.every((s) => s === 200), again.join(','))

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
const stars = page.locator(`#r-${SLUG}-1, #r-${SLUG}-2, #r-${SLUG}-3, #r-${SLUG}-4, #r-${SLUG}-5`)
check('the rating control is there', await stars.count() === 5, `${await stars.count()} yulduz`)
await page.locator(`#r-${SLUG}-5`).check({ force: true })

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

// ====================================================== the composer, one box
//
// The whole point of it: type a sentence, tap the place, tap a star, post.
// Counted in taps below, because "easy" is a claim about tap count and
// nothing else, and a form can pass every other test while still asking
// for eight things.
console.log('\nLentadagi bitta oyna:\n')

await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const box = page.locator('section textarea').first()
check('the composer is on the feed, not a link to a form', await box.count() > 0)
check('nothing is asked before you start typing',
  await page.locator('section select').count() === 0,
  `${await page.locator('section select').count()} dropdown`)

// 1. Type.
// Deliberately unlike the review text used earlier in this script: two
// bodies sharing a phrase made the matcher below pick the wrong row.
const COMPOSED = 'Çorsu bozorida qassoblar rastasi juda toza saqlanadi.'
await box.fill(COMPOSED)
await page.waitForTimeout(900)

// 2. Tap the place it matched.
const suggestion = page.locator('section ul button').first()
check('typing offers matching places', await suggestion.count() > 0)
const suggested = (await suggestion.innerText()).trim()
check('the match is the place that was named', /çorsu|chorsu/i.test(suggested), suggested)
await suggestion.click()
await page.waitForTimeout(200)
check('the chosen place shows as a chip',
  await page.getByRole('button', { name: /boşqa joy/i }).count() > 0)

// 3. Tap a star. 4. Post.
// By id, not position: StarRating gives each radio `<name>-<n>`, and a
// positional index silently picked a different group's star.
await page.locator('#compose-5').check({ force: true })
const postBtn = page.getByRole('button', { name: /^Joylaş$/ })
check('four taps and it can post', await postBtn.isEnabled())
await postBtn.click()
await page.waitForTimeout(1500)

check('it says it worked', await page.getByRole('status').count() > 0,
  (await page.getByRole('status').first().innerText().catch(() => '')).slice(0, 60))
check('it offers to show you your post',
  await page.getByRole('link', { name: /köriş/i }).count() > 0)

// Found by its text, not by position: an earlier section of this script
// left a review on the same place, and the list is ordered by usefulness
// rather than by recency.
const composed = (await asPage(page, 'GET', `/api/reviews/${SLUG}`)).json
const mine = composed.reviews?.find((r) => r.body === COMPOSED)
check('the review really is stored', Boolean(mine), `${composed.count} ta şarh`)
check('with the text that was typed', mine?.body === COMPOSED)
check('and the rating that was tapped', mine?.rating === 5, String(mine?.rating))

// The box empties, the way a composer does.
check('the box is empty again', (await box.inputValue()) === '')

// A place the directory does not have: same box, no category asked.
const fresh = await browser.newContext()
const freshPage = await fresh.newPage()
await freshPage.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })
await freshPage.waitForTimeout(600)
const box2 = freshPage.locator('section textarea').first()
await box2.fill('Lolazor qahvaxonasi, ertalabki non hali issiq böladi.')
await freshPage.waitForTimeout(900)

const nameField = freshPage.locator('section input[type=text], section input:not([type])').first()
check('a new place has its name proposed', await nameField.count() > 0)
check('the proposal is the first clause, not the whole sentence',
  (await nameField.inputValue()) === 'Lolazor qahvaxonasi',
  await nameField.inputValue())
check('no category is asked for',
  await freshPage.locator('section select').count() === 0)

await freshPage.locator('#compose-4').check({ force: true })
await freshPage.getByRole('button', { name: /^Joylaş$/ }).click()
await freshPage.waitForTimeout(1500)

const row = execFileSync('psql', ['-t', '-A', url, '-c',
  "select name || '|' || coalesce(category,'(yöq)') || '|' || coalesce(rating::text,'') "
  + 'from submissions order by created_at desc limit 1',
], { encoding: 'utf8' }).trim().split('|')
check('the new place was filed', row[0] === 'Lolazor qahvaxonasi', row[0])
check('its category was guessed from the name', row[1] === 'ovqatlanish/qahvaxona', row[1])
check('its first rating came with it', row[2] === '4', row[2])
await fresh.close()

// ============================================== two cities, two tabs
//
// The directory started as one city and the shape of everything — the
// district list, the map bounds, the browse URLs — assumed it. These
// check that the second city is a real place on the site rather than a
// row in a YAML file nothing reads.
console.log('\nIkki şahar:\n')

await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

/**
 * The feed has rows at all.
 *
 * Nothing else checked this, and a query bug emptied the whole home page
 * while every other check stayed green — the composer's suggestions come
 * from the search index, not the feed.
 */
const rows = page.locator('article, a[href^="/b/"]')
check('the feed shows listings', await rows.count() > 0, `${await rows.count()} ta qator`)

const tabs = page.locator('nav[aria-label="Şahar tanlaş"] a')
check('the feed has city tabs', await tabs.count() === 2, `${await tabs.count()} ta`)
check('the default city is first and current',
  (await tabs.first().getAttribute('aria-current')) === 'page',
  (await tabs.first().innerText()).trim())

const otherTab = tabs.nth(1)
const otherName = (await otherTab.innerText()).trim()
check('the second tab is Xorazm', /xorazm/i.test(otherName), otherName)
check('each tab is its own page', (await otherTab.getAttribute('href')) === '/xorazm',
  String(await otherTab.getAttribute('href')))

// A file, not a filtered render: it has to be right before any JS runs.
const xorazmHtml = await (await fetch(`${ORIGIN}/xorazm`)).text()
check('the Xorazm page is served as its own document',
  xorazmHtml.includes('Xorazm') && xorazmHtml.includes('Şahar tanlaş'))

const xorazmList = await (await fetch(`${ORIGIN}/api/list?city=xorazm`)).json()
check('Xorazm has its own districts', xorazmList.districts.length === 13,
  `${xorazmList.districts.length} ta`)
check('and none of Tashkent’s', !xorazmList.districts.some((d) => d.slug === 'chilonzor'))
check('Tashkent still has twelve',
  (await (await fetch(`${ORIGIN}/api/list`)).json()).districts.length === 12)

// A district names its city, so asking for one is asking for the other.
const byDistrict = await (await fetch(`${ORIGIN}/api/list?district=hazorasp`)).json()
check('a Khorezm district resolves to Khorezm', byDistrict.city === 'xorazm', byDistrict.city)

check('an unknown city 404s rather than rendering an empty feed',
  (await fetch(`${ORIGIN}/mars`)).status === 404,
  String((await fetch(`${ORIGIN}/mars`)).status))

// ----------------------------------------------- the add form, without selects
console.log('\nJoy qöşiş — tanlov tugmalari:\n')

await page.goto(`${ORIGIN}/qoshish`, { waitUntil: 'networkidle' })
await page.locator('input').first().fill('Registon qahvaxonasi')
await page.waitForTimeout(900)

check('no dropdown is left on the form',
  await page.locator('select').count() === 0,
  `${await page.locator('select').count()} ta select`)

const topChips = page.locator('fieldset input[name="f-top"]')
check('the type is a row of chips', await topChips.count() >= 5, `${await topChips.count()} ta`)
check('the guess from the name is already selected',
  await page.locator('fieldset input[name="f-top"][value="ovqatlanish"]').isChecked())

const subChips = page.locator('fieldset input[name="f-sub"]')
check('its sub-types appear without another tap', await subChips.count() >= 4,
  `${await subChips.count()} ta`)
await page.locator('fieldset input[name="f-sub"][value="qahvaxona"]').check({ force: true })
check('a sub-type can be chosen with one tap',
  await page.locator('fieldset input[name="f-sub"][value="qahvaxona"]').isChecked())

// City and district live under the disclosure.
await page.locator('details summary').first().click()
await page.waitForTimeout(300)
const cityChips = page.locator('fieldset input[name="f-city"]')
check('the city is a choice on the form', await cityChips.count() === 2, `${await cityChips.count()} ta`)
check('Tashkent districts are offered first',
  await page.locator('fieldset input[name="f-district"][value="chilonzor"]').count() === 1)

await page.locator('fieldset input[name="f-city"][value="xorazm"]').check({ force: true })
await page.waitForTimeout(400)
check('choosing Xorazm swaps the districts',
  await page.locator('fieldset input[name="f-district"][value="hazorasp"]').count() === 1
  && await page.locator('fieldset input[name="f-district"][value="chilonzor"]').count() === 0)

// ------------------------------------------- a Khorezm place, end to end
const khorezm = await asPage(page, 'POST', '/api/submissions', {
  name: 'Urganç non dökoni',
  category: CATEGORY,
  city: 'xorazm',
  district: 'urganch-shahri',
  lat: 41.55,
  lng: 60.63,
  rating: 5,
})
check('a Khorezm place can be added', khorezm.status === 200, `status ${khorezm.status}`)

const stored2 = execFileSync('psql', ['-t', '-A', url, '-c',
  "select city || '|' || coalesce(district,'') from submissions order by created_at desc limit 1",
], { encoding: 'utf8' }).trim()
check('it is filed under Xorazm', stored2 === 'xorazm|urganch-shahri', stored2)

const wrongPair = await asPage(page, 'POST', '/api/submissions', {
  name: 'Notöğri juftlik', category: CATEGORY, city: 'toshkent', district: 'hazorasp',
})
check('a district from the other city is refused', wrongPair.status === 400,
  `status ${wrongPair.status}`)

const wrongPin = await asPage(page, 'POST', '/api/submissions', {
  name: 'Notöğri nuqta', category: CATEGORY, city: 'xorazm', lat: 41.31, lng: 69.28,
})
check('a Tashkent pin on a Khorezm place is refused', wrongPin.status === 400,
  `status ${wrongPin.status}`)

// ========================================== the function without the data dir
//
// The bundle ships JavaScript and no `data/` directory. Everything that
// reads the catalogue used to do it with readFileSync at module load, so
// every endpoint importing it answered 500 in production while every
// check here stayed green — the pages that show that data are prerendered
// in CI, where the files are right there.
//
// This runs the built server from a directory that has no `data/`, which
// is what the deployed function actually is.
console.log('\nMaʼlumot papkasisiz server:\n')

const bare = `${process.env.TMPDIR ?? '/tmp'}/yalp-nodata-${process.pid}`
execFileSync('rm', ['-rf', bare])
execFileSync('mkdir', ['-p', bare])
execFileSync('cp', ['-r', '.output', bare])
check('the copy really has no data directory',
  !existsSync(`${bare}/data`) && existsSync(`${bare}/.output/server/index.mjs`))

const BARE_PORT = PORT + 3
const bareServer = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: bare,
  env: {
    ...process.env,
    DATABASE_URL: url,
    PORT: String(BARE_PORT),
    NITRO_PORT: String(BARE_PORT),
    HOST: '127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const bareLog = []
bareServer.stdout.on('data', (d) => bareLog.push(String(d)))
bareServer.stderr.on('data', (d) => bareLog.push(String(d)))

const bareOrigin = `http://127.0.0.1:${BARE_PORT}`
let bareUp = false
const bareDeadline = Date.now() + 30_000
while (Date.now() < bareDeadline && !bareUp) {
  bareUp = await fetch(`${bareOrigin}/api/auth/me`).then((r) => r.ok).catch(() => false)
  if (!bareUp) await new Promise((r) => setTimeout(r, 300))
}
check('it starts at all', bareUp)

if (bareUp) {
  for (const path of [
    '/api/facets',
    '/api/list?limit=2',
    `/api/business/${SLUG}`,
    `/api/reviews/${SLUG}`,
  ]) {
    const res = await fetch(`${bareOrigin}${path}`)
    check(`${path} answers`, res.ok, `HTTP ${res.status}`)
  }

  const facetsThere = await (await fetch(`${bareOrigin}/api/facets`)).json()
  check('the vocabulary the add form needs is there',
    facetsThere.categories?.length > 0 && facetsThere.cities?.length > 1,
    `${facetsThere.categories?.length} turi, ${facetsThere.cities?.length} şahar`)

  const addThere = await fetch(`${bareOrigin}/api/submissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: bareOrigin },
    body: JSON.stringify({ name: 'Papkasiz joy', category: CATEGORY, rating: 5 }),
  })
  check('a place can still be added', addThere.ok, `HTTP ${addThere.status}`)

  // Registration built its link from NUXT_PUBLIC_SITE_URL and threw on a
  // value with no scheme, which reached the visitor as "Server Error".
  const signup = await fetch(`${bareOrigin}/api/auth/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: bareOrigin },
    body: JSON.stringify({ email: 'sinov@yalp.uz', name: 'Sinov' }),
  })
  check('registering works', signup.ok, `HTTP ${signup.status}`)
  check('the login link points at the host that was asked',
    bareLog.join('').includes(`${bareOrigin}/api/auth/verify`),
    bareLog.join('').match(/http[^\s]*auth\/verify[^\s]*/)?.[0]?.slice(0, 60) ?? 'topilmadi')
}

bareServer.kill('SIGTERM')
execFileSync('rm', ['-rf', bare])

// --------------------------------------------------------- nothing was broken
check('no page errors', pageErrors.length === 0, pageErrors.join('; '))
check('nothing was blocked by the CSP', cspViolations.length === 0, cspViolations.join('; '))

await browser.close()
stop()

console.log(failures.length ? `\n${failures.length} ta muammo.\n` : '\nHammasi işlayapti.\n')
process.exit(failures.length ? 1 : 0)
