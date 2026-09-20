/**
 * Photo pipeline.  `npm run photos`
 *
 * Reads photos-src/<slug>/*.{jpg,png,webp} and writes compressed AVIF
 * into public/photos/, then records them in the business's YAML file.
 *
 * Compression is not cosmetic here. GitHub Pages repos have a ~1GB soft
 * limit and visitors are on mobile networks, so each image is squeezed
 * toward a byte target rather than a fixed quality — a busy photo and a
 * flat one should cost about the same.
 */
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import sharp from 'sharp'
import { parseDocument } from 'yaml'
import { DATA_DIR } from '../lib/load'
import { toAscii } from '../lib/alphabet'

const SRC = join(process.cwd(), 'photos-src')
const OUT = join(process.cwd(), 'public', 'photos')
const MAX_WIDTH = 1200
const TARGET_BYTES = 60 * 1024
const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'])

/** Step quality down until the file fits the budget, then stop. */
async function encode(input: string): Promise<Buffer> {
  const base = sharp(input).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true })
  let last: Buffer | null = null
  for (const quality of [55, 45, 38, 32, 26]) {
    const buf = await base.clone().avif({ quality, effort: 6 }).toBuffer()
    last = buf
    if (buf.length <= TARGET_BYTES) return buf
  }
  return last!
}

async function main() {
  if (!existsSync(SRC)) {
    console.log(`photos-src/ topilmadi.\nRasmlarni photos-src/<slug>/ ichiga qoʻying, soʻng qayta işga tuşiring.`)
    return
  }
  mkdirSync(OUT, { recursive: true })

  const slugs = readdirSync(SRC).filter((d) => statSync(join(SRC, d)).isDirectory())
  if (!slugs.length) { console.log('photos-src/ boʻş.'); return }

  let totalBytes = 0
  let count = 0

  for (const slug of slugs) {
    const yamlPath = join(DATA_DIR, 'businesses', `${slug}.yaml`)
    if (!existsSync(yamlPath)) {
      console.warn(`  oʻtkazib yuborildi: ${slug} — data/businesses/${slug}.yaml yoʻq`)
      continue
    }

    // parseDocument, not parse: it preserves the comments and field order
    // a human put in the file. Rewriting those away would make every
    // photo run show up as noise in the PR diff.
    const doc = parseDocument(readFileSync(yamlPath, 'utf8'))
    const name = String(doc.get('name') ?? slug)

    const sources = readdirSync(join(SRC, slug))
      .filter((f) => SOURCE_EXT.has(extname(f).toLowerCase()))
      .sort()

    const photos: { file: string; alt: string }[] = []

    for (const [i, file] of sources.entries()) {
      const outName = `${slug}-${i + 1}.avif`
      const buf = await encode(join(SRC, slug, file))
      writeFileSync(join(OUT, outName), buf)
      totalBytes += buf.length
      count += 1

      const kb = (buf.length / 1024).toFixed(0)
      const over = buf.length > TARGET_BYTES ? '  ← byudjetdan oşdi' : ''
      console.log(`  ${outName}  ${kb} KB${over}`)

      // Alt text in ASCII: it is read by crawlers and screen readers, and
      // it is one more place the searchable spelling appears.
      photos.push({ file: outName, alt: `${toAscii(name)} — ${i + 1}` })
    }

    if (photos.length) {
      /**
       * A JPEG copy of the first photo, sized for link previews.
       *
       * AVIF is right for the page but wrong here: Telegram, WhatsApp and
       * most other scrapers do not decode it, and an og:image they cannot
       * read produces a preview card with no picture at all. One extra
       * ~80KB JPEG per business buys a preview that people actually tap.
       */
      const ogName = `${slug}-og.jpg`
      const ogBuf = await sharp(join(SRC, slug, sources[0]))
        .rotate()
        .resize(1200, 630, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 76, mozjpeg: true })
        .toBuffer()
      writeFileSync(join(OUT, ogName), ogBuf)
      totalBytes += ogBuf.length
      console.log(`  ${ogName}  ${(ogBuf.length / 1024).toFixed(0)} KB  (link preview)`)

      doc.set('photos', photos)
      writeFileSync(yamlPath, doc.toString(), 'utf8')
      console.log(`  ${slug}: ${photos.length} ta rasm yozildi\n`)
    }
  }

  if (!count) { console.log('Hech qanday rasm topilmadi.'); return }

  const avgKb = totalBytes / count / 1024
  // ~600MB of the ~1GB Pages budget, leaving room for tiles and the site.
  const capacity = Math.floor((600 * 1024) / avgKb)
  console.log(
    `Jami: ${(totalBytes / 1024 / 1024).toFixed(1)} MB, ${count} ta rasm, ` +
    `oʻrtaça ${avgKb.toFixed(0)} KB.`,
  )
  console.log(`Şu oʻlçamda ~${capacity.toLocaleString('en-US')} ta rasm sigʻadi (600MB byudjet).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
