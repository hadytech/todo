import { catalog, categoryLabel, districtLabel } from '../../utils/catalog'
import { publishedFromQueue } from '../../utils/published'
import { toAscii } from '../../../lib/alphabet'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  /**
   * YAML first, then the queue.
   *
   * A listing that has been imported into git is the authoritative one,
   * and its row stops being served at that point — but checking YAML
   * first means that even if both existed for a moment, the reviewed
   * version wins.
   */
  const b = catalog.businesses.find((x) => x.slug === slug)
    ?? (await publishedFromQueue()).find((x) => x.slug === slug)
  if (!b) throw createError({ statusCode: 404, statusMessage: 'Joy topilmadi' })

  const districtName = b.district ? districtLabel(b.district) : undefined
  return {
    ...b,
    categoryName: categoryLabel(b.category),
    districtName,
    districtAscii: districtName ? toAscii(districtName) : undefined,
    categoryAscii: toAscii(categoryLabel(b.category)),
  }
})
