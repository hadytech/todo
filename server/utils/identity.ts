import { hashToken, newToken, currentUser, type SessionUser } from './auth'

/**
 * Who is writing, when writing does not require an account.
 *
 * A review has to be attributable to *something* or the two rules that
 * keep ratings honest cannot be enforced: one review per person per
 * place, and one vote per person per review. The usual answer is to
 * demand an account, which is how a directory ends up with no reviews —
 * the person who knows which barber is good is not the person who will
 * create a login to say so.
 *
 * So the attributable thing is a random token in a cookie, and nothing
 * else. What that buys, and what it deliberately does not:
 *
 *   - It is 256 bits of CSPRNG output, generated on the server. It is
 *     not derived from the address, the user agent, the screen, or
 *     anything else about the device, so it is not a fingerprint and
 *     cannot be reconstructed after it is cleared.
 *   - Only its SHA-256 reaches the database, for the same reason session
 *     tokens are stored that way: a leaked dump must not be replayable
 *     as a credential.
 *   - It is httpOnly, so no script on the page can read it, and it is
 *     first-party, so nothing off-site ever sees it.
 *   - It is minted on a write and never on a read. Someone who only
 *     reads the site is given no cookie at all, which is the difference
 *     between identifying an author and tracking a visitor.
 *   - Clearing it is a complete and unilateral opt-out. Nothing else
 *     links a person to what they wrote, which also means nothing can
 *     link what they wrote back to them.
 *
 * The cost is honest and worth stating: clearing the cookie also gives up
 * the ability to edit or delete what was written under it, and a
 * determined person can clear it to review the same place twice. That is
 * the price of not holding identities, and for a city directory it is the
 * right trade — the defence against a review farm is rate limiting and
 * moderation, not a login form that stops nobody and deters everybody.
 */

export const AUTHOR_COOKIE = 'yalp_author'

/** A year. Long enough that "edit my review" keeps working in practice. */
const AUTHOR_TTL_DAYS = 365

export interface Identity {
  /** Set when a real account is signed in. */
  user: SessionUser | null
  /** Set when the writer is anonymous. Exactly one of the two is set. */
  authorKey: string | null
  /**
   * The single value the votes table keys on.
   *
   * One column rather than two nullable ones, because a vote's identity
   * has no other job: it is not joined to, cascaded from, or displayed.
   */
  voter: string
}

/**
 * The writer's identity, minting an anonymous one if there is none.
 *
 * Call this from write handlers only. It sets a cookie, and a GET that
 * sets a cookie is a tracker.
 */
export async function writerIdentity(event: Parameters<typeof getCookie>[0]): Promise<Identity> {
  const user = await currentUser(event).catch(() => null)
  if (user) return { user, authorKey: null, voter: `u:${user.id}` }

  const existing = getCookie(event, AUTHOR_COOKIE)
  const raw = existing || newToken()
  if (!existing) {
    setCookie(event, AUTHOR_COOKIE, raw, {
      httpOnly: true,
      // Lax is doing real work here: it keeps the browser from sending
      // this cookie on a cross-site POST, which is what makes these
      // endpoints not CSRF-able by default. The Origin check in
      // `requireSameOrigin` is the belt to this braces.
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: AUTHOR_TTL_DAYS * 24 * 60 * 60,
    })
  }
  const authorKey = hashToken(raw)
  return { user: null, authorKey, voter: `a:${authorKey}` }
}

/**
 * The reader's identity, or nothing.
 *
 * Used by GET handlers to work out which reviews to mark as the visitor's
 * own. Never mints anything: a reader who has not written arrives with no
 * cookie and leaves with none.
 */
export async function readerIdentity(
  event: Parameters<typeof getCookie>[0],
): Promise<Identity | null> {
  const user = await currentUser(event).catch(() => null)
  if (user) return { user, authorKey: null, voter: `u:${user.id}` }

  const existing = getCookie(event, AUTHOR_COOKIE)
  if (!existing) return null
  const authorKey = hashToken(existing)
  return { user: null, authorKey, voter: `a:${authorKey}` }
}

/**
 * The display name a review is signed with.
 *
 * Anonymous writers may type one, and it is stored exactly as typed
 * after the characters that do not belong in a name are removed:
 * controls and direction overrides, which exist in a name field only to
 * make one thing render as another.
 *
 * What it is not is verified, and the interface says so — an anonymous
 * review is labelled as one next to whatever name it carries, so a
 * typed "Yalp.uz" cannot borrow authority a signed-in account would
 * have. Addresses and links are refused outright: a name field is not a
 * place to publish a phone number, least of all somebody else's.
 */
export const GUEST_NAME = 'Mehmon'

export function cleanAuthorName(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const name = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  if (name.length < 2) return null
  if (/[@<>]|https?:|\+?\d[\d\s-]{6,}/.test(name)) return null
  return name
}
