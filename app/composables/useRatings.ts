/**
 * Review scores for every listed place, fetched once per page.
 *
 * Listing pages are prerendered, so their cards ship with no scores and
 * fill in after hydration. That is the right trade for a listing: the
 * score is decoration there, while on a business page the reviews are
 * the content and are rendered on the server.
 *
 * One request serves every card on the page — a fetch per card would be
 * dozens of round trips for a few hundred bytes.
 */
export interface Rating {
  average: number | null
  count: number
  /** Bayesian score. For sorting only — never render this. */
  rank: number
}

/**
 * The in-flight request, so a page of twenty cards asks once.
 *
 * Module scope is safe here in a way it would not be for user data: this
 * is public, identical for every visitor, and only ever populated in the
 * browser — `load` is called from onMounted.
 */
let inflight: Promise<void> | null = null

export function useRatings() {
  const ratings = useState<Record<string, Rating>>('ratings', () => ({}))
  const loaded = useState<boolean>('ratings-loaded', () => false)

  function load(): Promise<void> {
    if (loaded.value) return Promise.resolve()
    inflight ??= fetchAll()
    return inflight
  }

  async function fetchAll() {
    try {
      const res = await $fetch<{ enabled: boolean; items: Record<string, Rating> }>('/api/ratings')
      if (res.enabled) ratings.value = res.items
    } catch {
      // A static build has no such endpoint. Cards simply show no score.
    } finally {
      loaded.value = true
    }
  }

  const get = (slug: string): Rating | undefined => ratings.value[slug]

  /**
   * Best first, by Bayesian score, then by review count.
   *
   * Unreviewed places keep their existing order at the end rather than
   * being dropped — a new listing nobody has reviewed is still the thing
   * someone is looking for.
   */
  function sortByRating<T extends { slug: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const x = ratings.value[a.slug]
      const y = ratings.value[b.slug]
      if (!x && !y) return 0
      if (!x) return 1
      if (!y) return -1
      return y.rank - x.rank || y.count - x.count
    })
  }

  return { ratings, loaded, load, get, sortByRating }
}
