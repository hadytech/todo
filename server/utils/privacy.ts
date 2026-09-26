import { dailyKey, ipSecret, tashkentDayStart } from '../../lib/privacy'

export { tashkentDayStart }

/**
 * The caller's address, as far as it can be known behind a proxy.
 *
 * `x-forwarded-for` is a list the proxy appends to, so the leftmost entry
 * is the client — and is also the only part a client can forge. That is
 * acceptable for throttling; it would not be acceptable as an
 * authorisation signal, and it is not used as one.
 *
 * This value never leaves this module. It goes straight into `ipKey` and
 * is not logged, returned or stored.
 */
function clientAddress(event: Parameters<typeof getRequestHeader>[0]): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return getRequestHeader(event, 'x-real-ip')
    || event.node?.req?.socket?.remoteAddress
    || 'unknown'
}

/**
 * A pseudonym for the caller's network, good for one day.
 *
 * This is the only form in which a request's origin is ever written down.
 * See lib/privacy.ts for why it rotates and what a stolen database dump
 * gets out of it.
 */
export function ipKey(
  event: Parameters<typeof getRequestHeader>[0],
  now: Date = new Date(),
): string {
  return dailyKey(ipSecret(), clientAddress(event), now)
}
