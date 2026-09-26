/**
 * Refuse a state-changing request that another site sent.
 *
 * The cookies these endpoints read are `sameSite: lax`, which already
 * means a browser will not attach them to a cross-site POST — so this is
 * the second lock, not the first. It is worth having because the first
 * one is set in a different file: someone relaxing a cookie to `none`
 * later, for a reason that looks good at the time, should not silently
 * open every write endpoint to any page on the internet.
 *
 * The check is on `Origin`, which a browser sets on every POST and which
 * page script cannot override. `Referer` is the fallback for the handful
 * of clients that still omit Origin. A request with neither is allowed
 * through: that is curl, or a mobile app, and neither carries anybody's
 * cookies — the request is only dangerous when a browser is being made
 * to speak for a person, and a browser always tells you where it came
 * from.
 */
export function requireSameOrigin(event: Parameters<typeof getRequestHeader>[0]): void {
  const stated = getRequestHeader(event, 'origin') || getRequestHeader(event, 'referer')
  if (!stated) return

  const host = getRequestHeader(event, 'host')
  if (!host) return

  let from: string
  try {
    from = new URL(stated).host
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'Söro rad etildi' })
  }

  if (from !== host) {
    throw createError({ statusCode: 403, statusMessage: 'Söro rad etildi' })
  }
}
