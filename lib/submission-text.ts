/**
 * A suggested place, as a plain-text message.
 *
 * This is the escape hatch for a build with no server behind it. The
 * form still collects everything; with nowhere to POST it, the visitor
 * gets the same facts as text they can send over Telegram — which in
 * Tashkent is the channel people actually have, unlike a GitHub account.
 *
 * Kept here rather than in the page so the exact shape a maintainer has
 * to read every day is pinned by tests.
 */
export interface Draft {
  name: string
  categoryLabel?: string
  districtLabel?: string
  address?: string
  coords?: { lat: number; lng: number } | null
  rating?: number
  phone?: string
  hoursNote?: string
  website?: string
  comment?: string
  contact?: string
}

const LABELS: [keyof Draft | 'coords' | 'rating', string][] = [
  ['categoryLabel', 'Turi'],
  ['rating', 'Baho'],
  ['districtLabel', 'Tuman'],
  ['address', 'Manzil'],
  ['coords', 'Nuqta'],
  ['phone', 'Telefon'],
  ['hoursNote', 'Iş vaqti'],
  ['website', 'Havola'],
  ['comment', 'Izoh'],
  ['contact', 'Men bilan aloqa'],
]

export function submissionText(d: Draft): string {
  const lines = [`yalp.uz — yangi joy: ${d.name.trim()}`, '']

  for (const [key, label] of LABELS) {
    if (key === 'rating') {
      // Stars rather than a bare number: a maintainer reading these in
      // a Telegram thread should see the rating without decoding it.
      if (d.rating) lines.push(`${label}: ${'★'.repeat(d.rating)}${'☆'.repeat(5 - d.rating)} (${d.rating}/5)`)
      continue
    }
    if (key === 'coords') {
      // Written as a bare "lat, lng" pair on purpose: that is a form
      // both `npm run entry` and every maps app accept when pasted.
      if (d.coords) lines.push(`${label}: ${d.coords.lat}, ${d.coords.lng}`)
      continue
    }
    const v = d[key]
    if (typeof v === 'string' && v.trim()) lines.push(`${label}: ${v.trim()}`)
  }

  return lines.join('\n')
}
