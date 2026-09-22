/**
 * Uzbek phone numbers, as typed by a person, turned into one shape.
 *
 * The public form must not reject "90 123 45 67" for lacking +998 — that
 * kind of pedantry is how a form loses the contributor it was built for.
 * So anything is accepted there and normalised here, and whatever cannot
 * be normalised is passed through untouched for a human to look at
 * rather than silently dropped or mangled.
 */
const SHAPE = /^\+998 \d{2} \d{3} \d{2} \d{2}$/

export function normalisePhone(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const digits = raw.replace(/\D/g, '')
  // A leading 998 is only the country code when stripping it leaves a
  // whole local number. "998123456" is nine digits already — a real
  // number on operator code 99 — and stripping it would leave six and
  // quietly fail. Length is what disambiguates, not the prefix.
  const local = digits.length === 12 && digits.startsWith('998')
    ? digits.slice(3)
    : digits
  if (local.length !== 9) return raw
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
}

/** Whether a string is already in the shape the YAML schema requires. */
export function isNormalised(s?: string | null): boolean {
  return Boolean(s && SHAPE.test(s))
}
