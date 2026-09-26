/**
 * The address to build a link back to this site with.
 *
 * A login link is the one URL that absolutely has to be right: it is sent
 * to an inbox, opened later, on another device, and there is no way to
 * correct it afterwards. So it is derived from the request that asked for
 * it, and the configured site URL is used only when it actually parses.
 *
 * Reversing the usual order is deliberate. `NUXT_PUBLIC_SITE_URL` is set
 * by hand in a dashboard, and a value with no scheme — `www.yalp.uz`
 * rather than `https://www.yalp.uz` — makes `new URL()` throw. That
 * surfaced as a bare "Server Error" on registration, with nothing
 * anywhere saying which of the endpoint's half-dozen steps had failed.
 *
 * The request cannot be wrong about which host somebody is on.
 */
export function siteOrigin(event: Parameters<typeof getRequestHeader>[0]): string {
  const host = getRequestHeader(event, 'host')
  if (host) {
    // Behind a proxy the scheme is in a header; locally there is none and
    // http is the honest answer.
    const proto = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim()
      || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  const configured = String(useRuntimeConfig(event).public.siteUrl ?? '')
  try {
    return new URL(configured).origin
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Sayt manzili sozlanmagan',
    })
  }
}
