/**
 * Generates every brand asset from one definition.  `npm run brand`
 *
 * The mark, the favicon, the app icons and the default share image all
 * come from the same source here, so they cannot drift apart — the usual
 * failure being a favicon still showing last year's logo because it was
 * exported by hand once and never again.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { MINT, LIGHT } from '../lib/brand'

const PUBLIC = join(process.cwd(), 'public')

/**
 * The mark: a map pin on a rounded mint tile.
 *
 * A pin because the site is about places, and because it survives being
 * 16 pixels wide in a browser tab — which rules out anything with fine
 * detail or a wordmark in it. The shoulders are squared off slightly
 * rather than a pure teardrop, which is the bit that stops it looking
 * like every other pin.
 */
export function markSvg({ tile = true, size = 512 } = {}): string {
  const pin = `
    <path fill="#fff" fill-rule="evenodd" d="
      M256 436
      C256 436 136 316 136 216
      a120 120 0 1 1 240 0
      c0 100 -120 220 -120 220
      Z
      M256 170
      a46 46 0 1 0 0 92
      a46 46 0 1 0 0 -92
      Z
    "/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}" role="img" aria-label="yalp.uz">
  <defs>
    <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${MINT[400]}"/>
      <stop offset="1" stop-color="${MINT[700]}"/>
    </linearGradient>
  </defs>
  ${tile ? `<rect width="512" height="512" rx="104" fill="url(#m)"/>` : ''}
  ${pin}
</svg>`
}

async function main() {
  mkdirSync(PUBLIC, { recursive: true })

  // Favicon stays SVG: one file, sharp at every size, theme-independent
  // because the tile carries its own background.
  writeFileSync(join(PUBLIC, 'favicon.svg'), markSvg())

  const svg = Buffer.from(markSvg())
  for (const size of [512, 192, 180, 32]) {
    const png = await sharp(svg, { density: 600 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer()
    writeFileSync(join(PUBLIC, `icon-${size}.png`), png)
  }

  // Share image: the mark beside the wordmark, on the brand canvas.
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="${LIGHT.canvas}"/>
    <g transform="translate(96 205) scale(0.43)">${markSvg({ size: 512 }).replace(/<\/?svg[^>]*>/g, '')}</g>
    <text x="352" y="330" font-family="DejaVu Sans, sans-serif" font-size="104" font-weight="bold" fill="${LIGHT.ink}">yalp<tspan fill="${LIGHT.accent}">.uz</tspan></text>
    <text x="356" y="392" font-family="DejaVu Sans, sans-serif" font-size="34" fill="${LIGHT.muted}">Toşkent joylari maʼlumotnomasi</text>
    <rect x="0" y="618" width="1200" height="12" fill="${MINT[400]}"/>
  </svg>`
  writeFileSync(
    join(PUBLIC, 'og.png'),
    await sharp(Buffer.from(og), { density: 200 }).png({ compressionLevel: 9 }).toBuffer(),
  )

  writeFileSync(join(PUBLIC, 'site.webmanifest'), `${JSON.stringify({
    name: 'yalp.uz',
    short_name: 'yalp.uz',
    description: 'Toshkent joylari maʼlumotnomasi',
    lang: 'uz',
    start_url: '/',
    display: 'standalone',
    background_color: LIGHT.canvas,
    theme_color: LIGHT.accent,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }, null, 2)}\n`)

  console.log('Brend fayllari tayyor: favicon.svg, icon-32/180/192/512.png, og.png, site.webmanifest')
}

main().catch((e) => { console.error(e); process.exit(1) })
