/**
 * One box, one button.
 *
 * The add-a-place form asked for a name, a category, a district, an
 * address, a photo, a rating, a comment and a pin, in that order, with a
 * disclosure section for the rest. Every one of those fields was
 * defensible and the whole was a form people abandon. Posting to Twitter
 * is one box and one button, and the reason it works is not that it asks
 * for less — it is that it asks for nothing it can work out itself.
 *
 * So: you type a sentence. The site matches it against places it already
 * knows and you tap the right one, the way you tap a mention. If it is
 * somewhere new, the name is proposed from what you typed and you can fix
 * it. The category is guessed from the name. Everything else — district,
 * address, hours, phone — is looked up later by whoever imports the
 * suggestion, because those are facts a stranger can verify and an
 * opinion is not.
 *
 * This module is the part of that with no DOM in it: what a composed post
 * means, and whether it can be sent.
 */

/** Sentence-ending marks, in either alphabet, plus a line break. */
const CLAUSE_END = /[.!?…\n;,]/

/**
 * A place name proposed from what somebody typed.
 *
 * Deliberately conservative: the first clause, at most six words. A
 * proposal that is too short is fixed with one tap; a proposal that
 * swallowed the whole review reads as broken and gets the box abandoned.
 */
export function candidateName(text: string): string {
  const firstClause = text.trim().split(CLAUSE_END)[0] ?? ''
  const words = firstClause.trim().split(/\s+/).filter(Boolean)
  const name = words.slice(0, 6).join(' ').slice(0, 120).trim()
  // Trailing joiners read as a truncation rather than a name.
  return name.replace(/\s+(va|bilan|uçun|haqida)$/i, '').trim()
}

/** The shortest review the database will accept. See db/schema.sql. */
export const MIN_REVIEW = 20
/** A name has to be a name. Same floor the submissions table enforces. */
export const MIN_NAME = 2

export interface Draft {
  /** What was typed. The review body, or a new place's comment. */
  text: string
  /** Slug of a place the directory already has, when one was chosen. */
  slug: string | null
  /** Name for a place it does not have, when that is what this is. */
  newName: string
  rating: number
  photo: string | null
}

export type Post =
  | { kind: 'review'; slug: string; rating: number; body: string }
  | { kind: 'place'; name: string; rating: number; comment?: string; photo?: string }

/**
 * What this draft would send, or null if it is not ready.
 *
 * Two destinations, one box. An opinion about a place the directory has is
 * a review; an opinion about one it does not have is a suggestion plus its
 * first rating — and from the person's side those are the same act, which
 * is why they are the same box.
 */
export function toPost(draft: Draft): Post | null {
  const text = draft.text.trim()
  if (draft.rating < 1 || draft.rating > 5) return null

  if (draft.slug) {
    // The review body has a floor because a star already carries "good":
    // the text is there to say the thing the number cannot.
    if (text.length < MIN_REVIEW) return null
    return { kind: 'review', slug: draft.slug, rating: draft.rating, body: text }
  }

  const name = draft.newName.trim()
  if (name.length < MIN_NAME) return null
  return {
    kind: 'place',
    name,
    rating: draft.rating,
    // Optional here, unlike a review: a name, a star and a photo of a
    // shop nobody has listed is already worth having.
    ...(text ? { comment: text } : {}),
    ...(draft.photo ? { photo: draft.photo } : {}),
  }
}

/**
 * Why the button is disabled, in the words shown next to it.
 *
 * One message at a time and only the next thing needed, rather than a
 * list of everything wrong: a composer that scolds is a composer people
 * close.
 */
export function blocker(draft: Draft): string | null {
  const text = draft.text.trim()
  if (!text && !draft.slug) return null

  if (!draft.slug && draft.newName.trim().length < MIN_NAME) return 'Joyni tanlang'
  if (draft.rating < 1) return 'Yulduz qöying'
  if (draft.slug && text.length < MIN_REVIEW) {
    return `Yana ${MIN_REVIEW - text.length} ta belgi`
  }
  return null
}
