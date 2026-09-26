/**
 * Removing metadata from a photo, and checking it is a photo at all.
 *
 * A picture taken on a phone carries an Exif block, and that block
 * routinely holds the GPS coordinates where the shutter was pressed, the
 * camera's serial number, and the owner's name. Someone photographing a
 * café to help this directory is not consenting to publish where they
 * were standing — so the metadata comes off before the bytes are stored.
 *
 * The browser already strips it as a side effect of re-encoding through a
 * canvas (`lib/photo.ts`). This exists because that is a side effect of
 * the happy path: anyone can post to the submissions endpoint directly,
 * and a guarantee that only holds when the client cooperates is not a
 * guarantee. It runs on the server, on every photo, whatever sent it.
 *
 * Nothing here re-encodes. Metadata lives in its own segments in all
 * three formats, so it can be cut out and the compressed pixels copied
 * across untouched — no generation loss, no image library, no native
 * dependency to install on a serverless runtime.
 */

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp'

/**
 * What these bytes actually are, by their signature — not by what the
 * caller claimed.
 *
 * A stored file is eventually written to disk and served. Believing a
 * declared content type is how an HTML or SVG payload ends up being
 * served as a photo and running as a page, so the declaration is checked
 * against the magic bytes and the bytes win.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const at = (i: number) => bytes[i]
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8
    && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47
    && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a
  ) return 'image/png'
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp'
  }
  return null
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let s = ''
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    s += String.fromCharCode(bytes[i]!)
  }
  return s
}

/**
 * JPEG application segments that are kept.
 *
 * APP0 is JFIF — pixel density, nothing about the photographer. APP2 is
 * an ICC colour profile; dropping it visibly shifts colour on a
 * wide-gamut phone photo, and a colour profile describes the screen the
 * picture was made on, not the person holding it.
 *
 * Everything else goes, which is the point: APP1 is Exif and XMP (GPS,
 * serial numbers, author, the editing history), APP13 is IPTC (credit,
 * contact), APP12 is Ducky, and the rest are vendor blocks nobody
 * needs. Comments (COM) go too — they are free text, and free text in an
 * image is exactly where a caption nobody reviewed hides.
 */
const JPEG_KEEP_APP = new Set([0xe0, 0xe2])

/** Markers that stand alone, with no length field after them. */
const JPEG_STANDALONE = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9])

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const out: Uint8Array[] = []
  let i = 0

  // The signature. Copied rather than assumed: sniffing has already run,
  // but this function must be correct on its own.
  out.push(bytes.subarray(0, 2))
  i = 2

  while (i < bytes.length) {
    // Segments are introduced by 0xFF. A run of fill bytes is legal
    // padding, so skip to the marker rather than treating the first
    // 0xFF as one.
    if (bytes[i] !== 0xff) break
    let j = i
    while (j < bytes.length && bytes[j] === 0xff) j += 1
    const marker = bytes[j]
    if (marker === undefined) break

    if (JPEG_STANDALONE.has(marker)) {
      out.push(bytes.subarray(i, j + 1))
      i = j + 1
      continue
    }

    const lenHi = bytes[j + 1]
    const lenLo = bytes[j + 2]
    if (lenHi === undefined || lenLo === undefined) break
    const length = (lenHi << 8) | lenLo
    // A length under two cannot include its own two bytes; the file is
    // malformed past this point and guessing further would be inventing
    // structure. Copy the remainder verbatim and stop.
    if (length < 2) break
    const end = j + 1 + length
    if (end > bytes.length) break

    const isApp = marker >= 0xe0 && marker <= 0xef
    const isComment = marker === 0xfe
    const drop = (isApp && !JPEG_KEEP_APP.has(marker)) || isComment
    if (!drop) out.push(bytes.subarray(i, end))

    // Start of scan: everything after this segment is entropy-coded
    // pixel data with no further segment structure worth walking.
    if (marker === 0xda) {
      out.push(bytes.subarray(end))
      return concat(out)
    }
    i = end
  }

  out.push(bytes.subarray(i))
  return concat(out)
}

/**
 * PNG chunks that are kept: the four critical ones plus the ancillary
 * chunks that change how the image is drawn.
 *
 * An allowlist rather than a blocklist, because PNG's metadata chunks
 * are open-ended — `eXIf`, `tEXt`, `iTXt`, `zTXt`, `tIME`, and whatever
 * a future editor invents. A blocklist would silently pass the next one.
 */
const PNG_KEEP = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND',
  'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'bKGD', 'pHYs', 'sBIT',
])

function stripPng(bytes: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [bytes.subarray(0, 8)]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let i = 8

  while (i + 8 <= bytes.length) {
    const length = view.getUint32(i)
    const type = ascii(bytes, i + 4, 4)
    // 4 length + 4 type + data + 4 CRC.
    const end = i + 12 + length
    if (end > bytes.length) break
    if (PNG_KEEP.has(type)) out.push(bytes.subarray(i, end))
    i = end
    if (type === 'IEND') break
  }

  return concat(out)
}

/**
 * WebP metadata chunks, dropped from the RIFF container.
 *
 * A blocklist is right here and wrong for PNG: WebP's chunk set is small
 * and fixed by the specification, and the image itself is carried in
 * chunks (`VP8 `, `VP8L`, `ANMF`, `ALPH`) an allowlist would have to
 * enumerate anyway. `ICCP` stays for the same reason APP2 does in JPEG.
 */
const WEBP_DROP = new Set(['EXIF', 'XMP '])

function stripWebp(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const kept: Uint8Array[] = []
  let i = 12
  let dropped = false

  while (i + 8 <= bytes.length) {
    const fourcc = ascii(bytes, i, 4)
    const size = view.getUint32(i + 4, true)
    // Chunks are padded to an even length; the pad byte is not counted
    // in the size field but is part of the stream.
    const end = i + 8 + size + (size % 2)
    if (end > bytes.length) break
    if (WEBP_DROP.has(fourcc)) dropped = true
    else kept.push(bytes.subarray(i, Math.min(end, bytes.length)))
    i = end
  }

  if (!dropped) return bytes

  const body = concat(kept)
  const head = new Uint8Array(12)
  head.set(bytes.subarray(0, 12))
  // RIFF's size field counts everything after it, so removing a chunk
  // means rewriting it — a container whose declared length overruns its
  // content is a file some decoders reject outright.
  new DataView(head.buffer).setUint32(4, 4 + body.length, true)
  return concat([head, body])
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/**
 * The same image with every metadata block removed.
 *
 * Returns the input unchanged when the bytes are not a format this
 * understands — the caller decides whether unknown bytes are acceptable,
 * and `sniffImageType` is how it decides.
 */
export function stripMetadata(bytes: Uint8Array): Uint8Array {
  switch (sniffImageType(bytes)) {
    case 'image/jpeg': return stripJpeg(bytes)
    case 'image/png': return stripPng(bytes)
    case 'image/webp': return stripWebp(bytes)
    default: return bytes
  }
}

/**
 * True when the bytes still carry something that could identify a person
 * or a place.
 *
 * Used by the tests to assert the strip actually worked, and by the
 * endpoint as a last check before a row is written: if a photo still
 * looks like it has metadata after stripping, the honest answer is to
 * refuse it rather than publish it.
 */
export function hasMetadata(bytes: Uint8Array): boolean {
  const type = sniffImageType(bytes)
  if (type === 'image/jpeg') {
    let i = 2
    while (i + 3 < bytes.length && bytes[i] === 0xff) {
      const marker = bytes[i + 1]!
      if (JPEG_STANDALONE.has(marker)) { i += 2; continue }
      const length = (bytes[i + 2]! << 8) | bytes[i + 3]!
      if (length < 2) return false
      const isApp = marker >= 0xe0 && marker <= 0xef
      if ((isApp && !JPEG_KEEP_APP.has(marker)) || marker === 0xfe) return true
      if (marker === 0xda) return false
      i += 2 + length
    }
    return false
  }
  if (type === 'image/png') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let i = 8
    while (i + 8 <= bytes.length) {
      const length = view.getUint32(i)
      const chunk = ascii(bytes, i + 4, 4)
      if (!PNG_KEEP.has(chunk)) return true
      i += 12 + length
      if (chunk === 'IEND') break
    }
    return false
  }
  if (type === 'image/webp') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let i = 12
    while (i + 8 <= bytes.length) {
      const fourcc = ascii(bytes, i, 4)
      if (WEBP_DROP.has(fourcc)) return true
      const size = view.getUint32(i + 4, true)
      i += 8 + size + (size % 2)
    }
    return false
  }
  return false
}

/**
 * Split a data URL into its declared type and its bytes.
 *
 * Returns null for anything that is not a base64 data URL, including the
 * percent-encoded form: the form sends base64 and only base64, so a
 * second accepted shape is a second thing to get right.
 */
export function decodeDataUrl(url: string): { declared: string; bytes: Uint8Array } | null {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(url)
  if (!match) return null
  try {
    const binary = globalThis.atob(match[2]!)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return { declared: match[1]!, bytes }
  } catch {
    return null
  }
}

export function encodeDataUrl(type: ImageType, bytes: Uint8Array): string {
  let binary = ''
  // Chunked: spreading a megabyte-long array into String.fromCharCode
  // overflows the argument limit and throws.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${type};base64,${globalThis.btoa(binary)}`
}

/**
 * The whole check, as one call for an endpoint to make.
 *
 * Either a clean data URL of a real image, or a reason it was refused.
 * The reasons are deliberately coarse — a caller probing this endpoint
 * should not learn which of several checks it failed.
 */
export function sanitisePhoto(
  dataUrl: string,
): { ok: true; dataUrl: string; type: ImageType } | { ok: false; reason: string } {
  const decoded = decodeDataUrl(dataUrl)
  if (!decoded) return { ok: false, reason: 'format' }

  const actual = sniffImageType(decoded.bytes)
  if (!actual) return { ok: false, reason: 'format' }
  // The declaration has to match the bytes. A mismatch is either a buggy
  // client or someone testing whether this endpoint can be used to store
  // a file that will later be served as something it is not.
  if (actual !== decoded.declared) return { ok: false, reason: 'format' }

  const clean = stripMetadata(decoded.bytes)
  if (hasMetadata(clean)) return { ok: false, reason: 'metadata' }

  return { ok: true, dataUrl: encodeDataUrl(actual, clean), type: actual }
}
