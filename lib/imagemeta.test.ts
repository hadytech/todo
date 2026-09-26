import { describe, expect, it } from 'vitest'
import {
  decodeDataUrl,
  encodeDataUrl,
  hasMetadata,
  sanitisePhoto,
  sniffImageType,
  stripMetadata,
} from './imagemeta'

/**
 * The fixtures are built here rather than checked in as binaries.
 *
 * A committed .jpg with GPS in it is a photo of somewhere, taken by
 * someone, and this repository would then be publishing exactly the
 * thing the module exists to remove. Assembling the segments in the test
 * also means the test states what it believes the format to be, so a
 * wrong belief fails visibly instead of being hidden inside an opaque
 * file.
 */

const bytes = (...parts: (number | number[] | Uint8Array | string)[]): Uint8Array => {
  const flat: number[] = []
  for (const p of parts) {
    if (typeof p === 'number') flat.push(p)
    else if (typeof p === 'string') for (const c of p) flat.push(c.charCodeAt(0))
    else for (const b of p) flat.push(b)
  }
  return new Uint8Array(flat)
}

/** A JPEG segment: FF, marker, two-byte length that counts itself. */
const seg = (marker: number, payload: Uint8Array): Uint8Array => {
  const length = payload.length + 2
  return bytes(0xff, marker, (length >> 8) & 0xff, length & 0xff, payload)
}

const APP0_JFIF = seg(0xe0, bytes('JFIF\0', 0x01, 0x02, 0x00, 0, 1, 0, 1, 0, 0))
/** Exif, with a GPS IFD tag number in it, as a phone would write. */
const APP1_EXIF = seg(0xe1, bytes('Exif\0\0', 'MM', 0x00, 0x2a, 0, 0, 0, 8, 0x88, 0x25))
const APP1_XMP = seg(0xe1, bytes('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>'))
const APP2_ICC = seg(0xe2, bytes('ICC_PROFILE\0', 1, 1, 0, 0, 0, 12))
const APP13_IPTC = seg(0xed, bytes('Photoshop 3.0\0'))
const COMMENT = seg(0xfe, bytes('Taken at home'))
const DQT = seg(0xdb, bytes(0x00, ...Array.from({ length: 64 }, () => 0x10)))
const SOF0 = seg(0xc0, bytes(0x08, 0, 16, 0, 16, 1, 0x11, 0x00))
const SOS = seg(0xda, bytes(0x01, 0x00, 0x00, 0x00, 0x3f, 0x00))
/** Entropy-coded data. Arbitrary, and must survive byte for byte. */
const SCAN = bytes(0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde)
const EOI = bytes(0xff, 0xd9)

const jpeg = (...middle: Uint8Array[]) =>
  bytes(0xff, 0xd8, ...middle, DQT, SOF0, SOS, SCAN, EOI)

/** A PNG chunk: length, type, data, and a CRC this test does not compute. */
const chunk = (type: string, data: Uint8Array = new Uint8Array()): Uint8Array => {
  const n = data.length
  return bytes((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff,
    type, data, 0xde, 0xad, 0xbe, 0xef)
}

const PNG_SIG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const png = (...chunks: Uint8Array[]) =>
  bytes(PNG_SIG, chunk('IHDR', bytes(0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0)),
    ...chunks, chunk('IDAT', bytes(0x78, 0x9c, 0x63, 0x00)), chunk('IEND'))

/** A RIFF chunk: fourcc, little-endian size, data, pad to even. */
const riff = (fourcc: string, data: Uint8Array): Uint8Array => {
  const n = data.length
  return bytes(fourcc, n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff,
    data, ...(n % 2 ? [0] : []))
}

const webp = (...chunks: Uint8Array[]) => {
  const body = bytes('WEBP', ...chunks)
  return bytes('RIFF', body.length & 0xff, (body.length >>> 8) & 0xff,
    (body.length >>> 16) & 0xff, (body.length >>> 24) & 0xff, body)
}

describe('sniffImageType', () => {
  it('reads the signature, not the caller', () => {
    expect(sniffImageType(jpeg())).toBe('image/jpeg')
    expect(sniffImageType(png())).toBe('image/png')
    expect(sniffImageType(webp(riff('VP8 ', bytes(1, 2, 3))))).toBe('image/webp')
  })

  it('refuses what is not an image', () => {
    // The two that matter: both would be served with a content type this
    // site chose, and both run script in a browser that sniffs.
    expect(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
    expect(sniffImageType(bytes('<!doctype html><script>'))).toBeNull()
    expect(sniffImageType(bytes())).toBeNull()
    // RIFF, but a WAV rather than a WebP.
    expect(sniffImageType(bytes('RIFF', 4, 0, 0, 0, 'WAVE'))).toBeNull()
  })
})

describe('stripMetadata — JPEG', () => {
  it('removes Exif, and says so', () => {
    const dirty = jpeg(APP0_JFIF, APP1_EXIF)
    expect(hasMetadata(dirty)).toBe(true)
    const clean = stripMetadata(dirty)
    expect(hasMetadata(clean)).toBe(false)
    expect(clean.length).toBeLessThan(dirty.length)
  })

  it('removes XMP, IPTC and comments too', () => {
    for (const block of [APP1_XMP, APP13_IPTC, COMMENT]) {
      expect(hasMetadata(jpeg(block))).toBe(true)
      expect(hasMetadata(stripMetadata(jpeg(block)))).toBe(false)
    }
  })

  it('keeps JFIF and the colour profile', () => {
    // Dropping APP2 would visibly shift the colours of a wide-gamut
    // phone photo, and a profile describes a screen, not a person.
    const clean = stripMetadata(jpeg(APP0_JFIF, APP1_EXIF, APP2_ICC))
    expect(Buffer.from(clean).includes(Buffer.from('JFIF'))).toBe(true)
    expect(Buffer.from(clean).includes(Buffer.from('ICC_PROFILE'))).toBe(true)
    expect(Buffer.from(clean).includes(Buffer.from('Exif'))).toBe(false)
  })

  it('leaves the pixels exactly as they were', () => {
    // The whole reason this does not re-encode: a second JPEG pass costs
    // quality, and no quality should be spent on removing metadata.
    const clean = stripMetadata(jpeg(APP1_EXIF, COMMENT))
    expect(Buffer.from(clean).subarray(-(SCAN.length + 2)))
      .toEqual(Buffer.from(bytes(SCAN, EOI)))
    expect(Buffer.from(clean).includes(Buffer.from(SCAN))).toBe(true)
  })

  it('is idempotent', () => {
    const once = stripMetadata(jpeg(APP0_JFIF, APP1_EXIF))
    expect(Buffer.from(stripMetadata(once))).toEqual(Buffer.from(once))
  })

  it('does not hang or throw on a truncated file', () => {
    const dirty = jpeg(APP1_EXIF)
    for (const cut of [2, 3, 5, 9, 14, dirty.length - 1]) {
      expect(() => stripMetadata(dirty.subarray(0, cut))).not.toThrow()
    }
    // A length field that overruns the buffer must not be believed.
    expect(() => stripMetadata(bytes(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2))).not.toThrow()
  })

  it('tolerates fill bytes before a marker', () => {
    const padded = bytes(0xff, 0xd8, 0xff, 0xff, APP1_EXIF.subarray(1), DQT, SOS, SCAN, EOI)
    expect(hasMetadata(stripMetadata(padded))).toBe(false)
  })
})

describe('stripMetadata — PNG', () => {
  it('removes eXIf and the text chunks', () => {
    for (const type of ['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']) {
      const dirty = png(chunk(type, bytes('Author', 0, 'someone')))
      expect(hasMetadata(dirty)).toBe(true)
      expect(hasMetadata(stripMetadata(dirty))).toBe(false)
    }
  })

  it('drops a chunk it has never heard of', () => {
    // An allowlist, so the metadata chunk some editor invents next year
    // is removed without this file being updated.
    expect(hasMetadata(png(chunk('zZzZ', bytes('anything'))))).toBe(true)
  })

  it('keeps the chunks that change how it is drawn', () => {
    const clean = stripMetadata(png(chunk('sRGB', bytes(0)), chunk('eXIf', bytes(1, 2))))
    expect(Buffer.from(clean).includes(Buffer.from('sRGB'))).toBe(true)
    expect(Buffer.from(clean).includes(Buffer.from('IDAT'))).toBe(true)
    expect(Buffer.from(clean).includes(Buffer.from('eXIf'))).toBe(false)
  })
})

describe('stripMetadata — WebP', () => {
  it('removes EXIF and XMP and fixes the container length', () => {
    const dirty = webp(riff('VP8 ', bytes(1, 2, 3, 4)), riff('EXIF', bytes('MM', 0, 42)))
    expect(hasMetadata(dirty)).toBe(true)

    const clean = stripMetadata(dirty)
    expect(hasMetadata(clean)).toBe(false)
    // RIFF's size counts everything after the field. A stale value here
    // is a file some decoders reject outright.
    const declared = new DataView(clean.buffer, clean.byteOffset).getUint32(4, true)
    expect(declared).toBe(clean.length - 8)
  })

  it('leaves a file with no metadata untouched', () => {
    const plain = webp(riff('VP8L', bytes(9, 9, 9)))
    expect(Buffer.from(stripMetadata(plain))).toEqual(Buffer.from(plain))
  })
})

describe('sanitisePhoto', () => {
  const url = (type: string, b: Uint8Array) => `data:${type};base64,${Buffer.from(b).toString('base64')}`

  it('returns a clean data URL', () => {
    const result = sanitisePhoto(url('image/jpeg', jpeg(APP0_JFIF, APP1_EXIF)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.type).toBe('image/jpeg')
    const back = decodeDataUrl(result.dataUrl)!
    expect(hasMetadata(back.bytes)).toBe(false)
  })

  it('refuses a type that disagrees with the bytes', () => {
    // Storing a PNG as a JPEG is harmless; storing anything as a type
    // the site later serves it under is not, and the same check covers
    // both without having to tell them apart.
    const result = sanitisePhoto(url('image/jpeg', png()))
    expect(result).toEqual({ ok: false, reason: 'format' })
  })

  it('refuses a payload that is not an image at all', () => {
    expect(sanitisePhoto(url('image/svg+xml', bytes('<svg onload=alert(1)>'))).ok).toBe(false)
    expect(sanitisePhoto(url('image/jpeg', bytes('<!doctype html>'))).ok).toBe(false)
    expect(sanitisePhoto('data:image/jpeg;base64,not base64!').ok).toBe(false)
    expect(sanitisePhoto('https://example.com/cat.jpg').ok).toBe(false)
    // The percent-encoded form is a second shape to get right, so it is
    // not accepted at all.
    expect(sanitisePhoto('data:image/jpeg,%FF%D8%FF').ok).toBe(false)
  })

  it('gives the same coarse reason whichever check failed', () => {
    // A caller probing the endpoint should not be able to use the error
    // message to work out what it checks.
    const reasons = [
      sanitisePhoto(url('image/jpeg', png())),
      sanitisePhoto(url('image/gif', bytes('GIF89a'))),
      sanitisePhoto('nonsense'),
    ].map((r) => (r.ok ? 'ok' : r.reason))
    expect(new Set(reasons)).toEqual(new Set(['format']))
  })
})

describe('data URL round trip', () => {
  it('survives a size that overflows an argument list', () => {
    // 0x8000 is the chunk size in encodeDataUrl; the bug this guards
    // against only appears past it.
    const big = new Uint8Array(0x8000 * 2 + 17).map((_, i) => i % 251)
    const round = decodeDataUrl(encodeDataUrl('image/jpeg', big))!
    expect(round.bytes.length).toBe(big.length)
    expect(Buffer.from(round.bytes)).toEqual(Buffer.from(big))
  })
})
