/**
 * Reading a shared map link.
 *
 * The premise of the public form is that most people arrive with the
 * place already open in a maps app. What they can produce in one tap is
 * a share link — so the more a link yields, the less there is to type,
 * and a link that yields the name, the address and the pin means the
 * whole form is one paste.
 *
 * Kept separate from coords.ts because that module is about one number
 * pair and this one is about everything a URL can be made to give up.
 */
import { parseCoords, type Coords } from './coords'

export interface MapLink {
  coords: Coords | null
  /** The place's name, where the URL carries one. */
  name: string | null
  /** A street address, where the URL carries one. */
  address: string | null
  /**
   * True when the link is a short share URL that has to be followed
   * before it says anything. These are what phone share buttons
   * actually produce, so this is the common case, not the exotic one.
   */
  needsResolving: boolean
}

const EMPTY: MapLink = { coords: null, name: null, address: null, needsResolving: false }

/**
 * Hosts a share link may point at.
 *
 * This list is also the SSRF allowlist for the endpoint that follows
 * these links server-side — anything not named here is never fetched.
 * Kept here, beside the parsers, so the two cannot drift apart.
 */
export const MAP_HOSTS = [
  'yandex.com', 'yandex.ru', 'yandex.uz', 'yandex.kz',
  'maps.yandex.com', 'maps.yandex.ru', 'maps.yandex.uz',
  'google.com', 'www.google.com', 'maps.google.com',
  'google.uz', 'www.google.uz', 'maps.app.goo.gl', 'goo.gl',
  '2gis.uz', 'go.2gis.com',
]

/** Whether this URL is one we are willing to follow. */
export function isMapHost(url: string): boolean {
  try {
    return MAP_HOSTS.includes(new URL(url).hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Short links carry nothing but an id — no coordinates, no name. They
 * have to be followed to become useful, which a browser cannot do
 * cross-origin, so the server does it.
 */
function isShortLink(u: URL): boolean {
  if (u.hostname === 'maps.app.goo.gl' || u.hostname === 'goo.gl') return true
  if (u.hostname === 'go.2gis.com') return true
  // yandex.ru/maps/-/CDxxxxxx — the share-sheet form.
  return /\/maps\/-\//.test(u.pathname)
}

/** Turn "chorsu_bozori" or "Chorsu+Bazaar" into something readable. */
function humanise(raw: string): string | null {
  const s = decodeURIComponent(raw).replace(/[+_]+/g, ' ').trim()
  // A bare id, a coordinate pair or a single letter is not a name.
  if (s.length < 2 || /^[\d.,\s-]+$/.test(s)) return null
  return s.replace(/\s+/g, ' ').slice(0, 120)
}

export function parseMapLink(input: string): MapLink {
  const raw = input.trim()
  if (!raw) return EMPTY

  let u: URL
  try {
    u = new URL(raw)
  } catch {
    // Not a URL at all — it may still be a bare coordinate pair.
    return { ...EMPTY, coords: parseCoords(raw) }
  }

  if (isShortLink(u)) return { ...EMPTY, needsResolving: true }

  const coords = parseCoords(raw)
  let name: string | null = null
  let address: string | null = null

  // Google: /maps/place/<Name>/@lat,lng,17z
  const gPlace = u.pathname.match(/\/maps\/place\/([^/@]+)/)
  if (gPlace) name = humanise(gPlace[1]!)

  // Yandex org page: /maps/org/<slug>/<id>/ — the slug is a
  // transliterated name, which is a much better starting point than an
  // empty field even when it needs tidying.
  const yOrg = u.pathname.match(/\/maps\/org\/([^/]+)\//)
  if (yOrg && !name) name = humanise(yOrg[1]!)

  // Yandex also passes the searched text, which is often exactly what
  // the person typed to find the place.
  const text = u.searchParams.get('text')
  if (text && !name) {
    const t = humanise(text)
    // "41.3,69.2" as search text is a coordinate, not a name.
    if (t && !parseCoords(text)) name = t
  }

  // 2GIS: /tashkent/firm/<id> carries no name, but /geo/ URLs sometimes
  // carry the address as the search text.
  const q = u.searchParams.get('q') || u.searchParams.get('query')
  if (q && !name) name = humanise(q)

  const whatsHere = u.searchParams.get('whatshere[point]')
  if (whatsHere && !coords) {
    const c = parseCoords(whatsHere.replace(/(-?\d+\.\d+)[,%2C]+(-?\d+\.\d+)/i, '$2,$1'))
    if (c) return { coords: c, name, address, needsResolving: false }
  }

  return { coords, name, address, needsResolving: false }
}
