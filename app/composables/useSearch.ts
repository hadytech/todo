import MiniSearch from 'minisearch'
import { searchOptions, type IndexedBusiness } from '../../lib/search'

let indexPromise: Promise<MiniSearch<IndexedBusiness>> | null = null

/**
 * Loads the prebuilt index on first use — never on page load. A visitor
 * who came to read one business page should not pay for search they
 * never opened.
 */
export function useSearchIndex() {
  const base = useRuntimeConfig().app.baseURL

  function load() {
    if (!indexPromise) {
      indexPromise = fetch(`${base}search-index.json`.replace(/\/+/g, '/'))
        .then((r) => r.text())
        .then((json) => MiniSearch.loadJSON<IndexedBusiness>(json, searchOptions))
    }
    return indexPromise
  }

  return { load }
}
