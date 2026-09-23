/**
 * Preparing a photo in the browser before it is sent.
 *
 * A phone camera produces 3–8MB. That is far more than a directory
 * listing needs, it is more than a form post should carry, and it is
 * more than a free Postgres tier will tolerate a queue of. So the
 * resizing happens on the device, where the pixels already are, rather
 * than being uploaded and then thrown away server-side.
 */

/** Longest edge, in pixels, after resizing. */
export const MAX_EDGE = 1280
/** JPEG quality. Low enough to be small, high enough for a shopfront. */
export const QUALITY = 0.75
/**
 * Hard ceiling on the encoded string, in bytes.
 *
 * Checked again on the server, because a limit enforced only in the
 * browser is not a limit.
 */
export const MAX_ENCODED = 400_000

/**
 * Scale a photo down to fit a square of `max`, never up.
 *
 * Separated from the canvas work so the arithmetic — the part with the
 * off-by-one and the upscaling bug in it — can be tested without a DOM.
 */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const longest = Math.max(width, height)
  // Enlarging a small photo adds bytes and no detail.
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) }
  const scale = max / longest
  return {
    // A dimension must never round to zero, or the canvas throws.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Rough decoded size of a base64 data URL, without decoding it. */
export function encodedBytes(dataUrl: string): number {
  return dataUrl.length
}

/**
 * Read a file the visitor chose and return a compressed JPEG data URL.
 *
 * Browser-only: it needs createImageBitmap and a canvas.
 */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  // JPEG rather than WebP or AVIF: every browser can encode it, and the
  // file is re-encoded properly by `npm run photos` once it is imported.
  return canvas.toDataURL('image/jpeg', QUALITY)
}
