import { z } from 'zod'
import { isMapHost, parseMapLink } from '../../lib/maplink'

/**
 * Follow a shared map link far enough to read what it points at.
 *
 * This exists because of how sharing actually works on a phone: the
 * share button in Yandex Maps or Google Maps produces a short link that
 * carries an id and nothing else. The browser cannot follow it — it is
 * cross-origin and the response has no CORS headers — so the server
 * does, and hands back the name and the pin it redirects to.
 *
 * That turns the form's slowest step into a paste.
 */
const Body = z.object({ url: z.string().trim().url().max(500) })

/** Redirect chains are short in practice; more than this is a loop. */
const MAX_HOPS = 5
const TIMEOUT_MS = 6000

export default defineEventHandler(async (event) => {
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Havola notoʻğri' })
  }

  let url = parsed.data.url

  /**
   * The whole security story of this endpoint.
   *
   * It fetches a URL chosen by an anonymous caller, which is a
   * server-side request forgery primitive unless the target is
   * constrained. Every hop is checked, not just the first — a redirect
   * to 169.254.169.254 would otherwise walk straight out of the
   * allowlist and into the cloud metadata service.
   */
  if (!isMapHost(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Faqat Yandex, Google yoki 2GIS xarita havolasi',
    })
  }

  /**
   * A long URL already says everything it is going to say. Only the
   * short share links need following, so anything else is answered
   * without an outbound request at all.
   */
  if (!parseMapLink(url).needsResolving) {
    const direct = parseMapLink(url)
    return {
      ok: Boolean(direct.coords || direct.name),
      url,
      coords: direct.coords,
      name: direct.name,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Some map hosts serve a redirect only to something that looks
          // like a browser, and a bare fetch gets an interstitial.
          'user-agent': 'Mozilla/5.0 (compatible; yalp.uz/1.0; +https://yalp.uz)',
          'accept-language': 'uz,ru;q=0.8,en;q=0.6',
        },
      })

      const next = res.headers.get('location')
      if (!next) break

      const resolved = new URL(next, url).toString()
      if (!isMapHost(resolved)) {
        // A redirect off the allowlist. Stop and answer with what the
        // last good URL said, rather than following it.
        break
      }
      url = resolved
    }
  } catch {
    // A timeout or a refused connection is not an error worth showing:
    // the form still works, the person just fills the pin another way.
    return { ok: false, url: parsed.data.url }
  } finally {
    clearTimeout(timer)
  }

  const link = parseMapLink(url)
  return {
    ok: Boolean(link.coords || link.name),
    url,
    coords: link.coords,
    name: link.name,
  }
})
