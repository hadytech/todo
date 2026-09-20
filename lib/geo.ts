/**
 * Distance helpers for "near me".
 *
 * Tashkent spans roughly 30km, so a spherical earth is far more accuracy
 * than this needs — the error is metres over the whole city.
 */
const EARTH_RADIUS_M = 6_371_000

export interface Point { lat: number; lng: number }

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in metres. */
export function distanceMetres(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * "450 m" / "1,2 km" / "12 km".
 *
 * Uzbek uses a comma as the decimal separator, and a false sense of
 * precision is worse than none — nobody needs "1,23 km".
 */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`
  const km = metres / 1000
  return km < 10
    ? `${km.toFixed(1).replace('.', ',')} km`
    : `${Math.round(km)} km`
}

/** True when a point is plausibly inside the Tashkent area. */
export function inTashkent(p: Point): boolean {
  return p.lat >= 41.15 && p.lat <= 41.45 && p.lng >= 69.10 && p.lng <= 69.55
}
