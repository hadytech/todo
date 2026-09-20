/**
 * Coordinate parsing for the entry form. Lives here rather than in
 * scripts/entry.ts so it can be tested without booting the server.
 */
export interface Coords { lat: number; lng: number }

export function parseCoords(input: string): Coords | null {
  const s = decodeURIComponent(input.trim())

  // Yandex puts ll=LNG,LAT — reversed from everyone else. Must be checked
  // first: the bare-pair regex below would match it silently backwards and
  // drop the pin in Saudi Arabia.
  const yandex = s.match(/[?&]ll=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i)
  if (yandex) return { lat: +yandex[2], lng: +yandex[1] }

  const google = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (google) return { lat: +google[1], lng: +google[2] }

  const pair = s.match(/^(-?\d+\.\d+)\s*[,;]\s*(-?\d+\.\d+)$/)
  if (pair) return { lat: +pair[1], lng: +pair[2] }

  return null
}
