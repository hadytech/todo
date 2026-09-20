/**
 * Generates a link-preview card for every business without a photo.
 *
 * Early on almost nothing has photos, so without this every share in
 * Telegram shows the same generic yalp.uz card — indistinguishable from
 * every other link and far less likely to be tapped. A card naming the
 * business, its category and its district is a large improvement for
 * about 20KB apiece.
 *
 * Businesses that do have photos use the JPEG variant from `npm run
 * photos` instead; this only fills the gap.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { loadBusinesses, loadCategories, loadDistricts, publishedOnly } from '../lib/load'
import { toDisplay } from '../lib/alphabet'

const OUT = join(process.cwd(), 'public', 'og')
const W = 1200
const H = 630
const FONT = 'DejaVu Sans, FreeSans, Liberation Sans, sans-serif'

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!
  ))

/**
 * SVG has no text wrapping, so lines are measured by an approximation of
 * average glyph width. It only needs to be good enough to avoid running
 * off the card.
 */
function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const perChar = fontSize * 0.55
  const lines: string[] = []
  let line = ''

  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length * perChar <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    }
  }
  if (lines.length < maxLines && line) lines.push(line)

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1]!
    if (last.length * perChar > maxWidth) {
      lines[maxLines - 1] = `${last.slice(0, Math.floor(maxWidth / perChar) - 1)}…`
    }
  }
  return lines
}

function card(name: string, subtitle: string): string {
  const titleSize = name.length > 34 ? 66 : 84
  const lines = wrap(name, titleSize, W - 160, 2)
  const startY = lines.length > 1 ? 280 : 330

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0f766e"/>
  <rect x="0" y="${H - 12}" width="${W}" height="12" fill="#5eead4"/>
  ${lines.map((l, i) => `<text x="80" y="${startY + i * (titleSize + 14)}" font-family="${FONT}" font-size="${titleSize}" font-weight="bold" fill="#ffffff">${escapeXml(l)}</text>`).join('\n  ')}
  <text x="80" y="${startY + lines.length * (titleSize + 14) + 30}" font-family="${FONT}" font-size="40" fill="#a7f3d0">${escapeXml(subtitle)}</text>
  <text x="80" y="${H - 60}" font-family="${FONT}" font-size="34" font-weight="bold" fill="#ffffff" opacity="0.85">yalp.uz</text>
</svg>`
}

/**
 * A missing font renders as an empty card rather than an error — a silent
 * failure that would ship. Check once, loudly, before generating 300 of them.
 */
async function assertFontRenders() {
  const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">
    <rect width="400" height="100" fill="#000"/>
    <text x="10" y="70" font-family="${FONT}" font-size="56" fill="#fff">Çöğş</text></svg>`
  const { data } = await sharp(Buffer.from(probe)).greyscale().raw().toBuffer({ resolveWithObject: true })
  let lit = 0
  for (let i = 0; i < data.length; i++) if (data[i]! > 128) lit++
  if (lit < 200) {
    throw new Error(
      'Şrift topilmadi — kartalar boʻş çiqadi.\n'
      + 'CI da oʻrnating: sudo apt-get install -y fonts-dejavu-core',
    )
  }
}

async function main() {
  await assertFontRenders()

  const { businesses } = loadBusinesses()
  const categoryNames = new Map(
    loadCategories().flatMap((c) => c.children.map((ch) => [`${c.slug}/${ch.slug}`, ch.name])),
  )
  const districtNames = new Map(loadDistricts().map((d) => [d.slug, d.name]))

  const needCards = publishedOnly(businesses).filter((b) => !b.photos.length)

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  let bytes = 0
  for (const b of needCards) {
    const subtitle = [categoryNames.get(b.category), districtNames.get(b.district)]
      .filter(Boolean).join(' · ')
    const png = await sharp(Buffer.from(card(toDisplay(b.name), subtitle)))
      .png({ compressionLevel: 9, palette: true })
      .toBuffer()
    writeFileSync(join(OUT, `${b.slug}.png`), png)
    bytes += png.length
  }

  console.log(
    needCards.length
      ? `Havola kartalari: ${needCards.length} ta, ${(bytes / 1024).toFixed(0)} KB jami.`
      : 'Havola kartalari kerak emas — hamma joyda rasm bor.',
  )
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1) })
