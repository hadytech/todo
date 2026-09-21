/**
 * The brand, defined once.
 *
 * Every colour the site uses comes from here, and `lib/brand.test.ts`
 * asserts both that the palette meets WCAG AA in each theme and that
 * app/assets/css/main.css still matches these values — so the stylesheet
 * and this file cannot drift apart without a test failing.
 */

/** Mint. The accent the identity is built from. */
export const MINT = {
  50: '#ECFBF6',
  100: '#D1F5EA',
  200: '#A3EAD6',
  300: '#6BDBBF',
  400: '#34C4A4',
  500: '#14A88B',
  600: '#0C8A72',
  700: '#0B6D5B',
  800: '#0C5749',
  900: '#0A463C',
} as const

/**
 * Neutrals carry a slight green bias rather than being pure grey, so they
 * read as chosen alongside the mint instead of inherited from a default.
 */
export const LIGHT = {
  canvas: '#F6F9F7',
  surface: '#FFFFFF',
  raised: '#EBF2EE',
  ink: '#0F1A17',
  muted: '#5A6A64',
  line: '#DCE8E3',
  // mint-600 measures 4.29:1 on white and fails AA for text; 700 passes.
  accent: MINT[700],
  accentInk: '#FFFFFF',
  accentSoft: MINT[100],
} as const

export const DARK = {
  canvas: '#0E1513',
  surface: '#16211E',
  raised: '#1F2C28',
  ink: '#E9F1EE',
  muted: '#90A49E',
  line: '#27342F',
  accent: MINT[300],
  accentInk: '#062019',
  accentSoft: '#123029',
} as const

/** Relative luminance, per WCAG 2.x. */
export function luminance(hexColor: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** WCAG contrast ratio between two hex colours, 1–21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
