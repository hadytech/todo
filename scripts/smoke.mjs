/**
 * Drive the add-a-place form in a real browser.  `npm run smoke`
 *
 * Every bug this catches was shipped past a green test suite, because
 * none of them live in a function. They live in whether the form is on
 * screen when you have typed a name, and whether the button reaches
 * anywhere. Unit tests cannot see either.
 *
 * Runs against the static build, which is the strictest case: no
 * server, no database, every API route absent. If the form works there
 * it works anywhere.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = '.output/public'
const PORT = 4199
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
}

/** Directory-index resolution, the way GitHub Pages and Vercel both do it. */
const server = createServer(async (req, res) => {
  try {
    const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
    let file = join(ROOT, clean)
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html')
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(PORT, r))

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch({
  // The image this runs in ships a browser; CI installs one.
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

let opened = null
ctx.on('page', (p) => { opened = p.url() })

console.log('\nJoy qöşiş — statik qurilişda:\n')
await page.goto(`http://127.0.0.1:${PORT}/qoshish/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

check('the one field is there', await page.locator('#f-primary').isVisible())

// There must be nothing beside it that looks like a submit. The removed
// "Öqiş" button read as the way to send the name and did nothing.
check('nothing beside the field pretends to submit it',
  await page.locator('#f-primary ~ button, #f-primary + button').count() === 0)

/**
 * The regression this exists for.
 *
 * The form was gated on a value that only updated on blur, so on a
 * phone you typed the name and the screen stayed empty until you
 * dismissed the keyboard. Type without blurring — that is what a
 * person does.
 */
await page.locator('#f-primary').click()
await page.keyboard.type('Çorsu Sartaroşxonasi', { delay: 10 })
await page.waitForTimeout(400)
check('typing a name reveals the form, without blurring',
  await page.locator('#f-top').count() === 1)
check('the photo control appears', await page.getByText('Rasm qöşiş').count() === 1)
check('the rating appears', await page.getByText('Bahoyingiz').count() === 1)

/**
 * Everything past here needs the form to exist. Without this guard a
 * regression in the gate above turns into a thirty-second Playwright
 * timeout and a stack trace, which buries the two checks that actually
 * explained the problem.
 */
if (failures.length) {
  console.log('\n  (forma körinmadi — qolgan tekşiruvlar öçirildi)')
  await browser.close()
  server.close()
  console.log(`\n${failures.length} ta muammo.\n`)
  process.exit(1)
}

await page.selectOption('#f-top', 'gozallik')
await page.waitForTimeout(200)
await page.selectOption('#f-sub', 'sartaroshxona')
await page.locator('fieldset label').nth(4).click()
await page.locator('#f-comment').fill('Navbat kam, narxi arzon')
await page.waitForTimeout(300)

const btn = page.locator('button[type=submit]')
check('the submit button is enabled', await btn.isEnabled())

const label = (await btn.innerText()).trim()
// It said "copy and send" while only copying. A button must not claim
// to do something the page cannot do.
check('the button does not promise a send it cannot make',
  !/yuboriş/i.test(label) || /telegram|github/i.test(label), `label: "${label}"`)

await btn.click()
await page.waitForTimeout(1200)
check('submitting opens a real destination', Boolean(opened), opened?.slice(0, 60) ?? 'nothing opened')
check('a confirmation is shown', await page.getByText('Matn nusxalandi').count() > 0)

const href = await page.locator('a[target=_blank]').last().getAttribute('href')
check('the destination carries the submission', Boolean(href && href.length > 80))

check('no page errors', pageErrors.length === 0, pageErrors.join('; '))

await browser.close()
server.close()

console.log(failures.length ? `\n${failures.length} ta muammo.\n` : '\nHammasi işlayapti.\n')
process.exit(failures.length ? 1 : 0)
