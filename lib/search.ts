import type { Options as MiniSearchOptions } from 'minisearch'
import { toSearchKey } from './alphabet'

/**
 * Shared by the build script and the browser. Both MUST use this exact
 * object: if the index is tokenized differently from the query, search
 * fails silently — results just quietly go missing, with no error.
 */
export interface IndexedBusiness {
  id: string
  name: string
  address: string
  category: string
  district: string
  /** Alternative names for the category — see lib/synonyms.ts. */
  terms: string
  lat: number
  lng: number
  price?: number
}

export const searchOptions: MiniSearchOptions = {
  fields: ['name', 'address', 'category', 'district', 'terms'],
  storeFields: ['name', 'address', 'category', 'district', 'lat', 'lng', 'price'],
  /**
   * The whole cross-alphabet story lives here. Folding inside the
   * tokenizer means "çorsu", "chorsu", "cho'rsu" and "Чорсу" produce
   * identical tokens on both the indexing and the querying side.
   */
  tokenize: (text: string) => toSearchKey(text).split(' ').filter(Boolean),
  processTerm: (term: string) => term || null,
  searchOptions: {
    // Synonyms are a fallback, not a headline: a place actually named
    // "Apteka" should outrank every pharmacy matched through the word.
    boost: { name: 3, category: 2, terms: 0.5 },
    prefix: true,
    // Typo tolerance. Worth having when people are typing an alphabet
    // their keyboard does not have.
    fuzzy: 0.2,
  },
}
