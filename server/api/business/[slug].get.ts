import { catalog, categoryLabel, districtLabel } from '../../utils/catalog'
import { toAscii } from '../../../lib/alphabet'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const b = catalog.businesses.find((x) => x.slug === slug)
  if (!b) throw createError({ statusCode: 404, statusMessage: 'Joy topilmadi' })

  return {
    ...b,
    categoryName: categoryLabel(b.category),
    districtName: districtLabel(b.district),
    districtAscii: toAscii(districtLabel(b.district)),
    categoryAscii: toAscii(categoryLabel(b.category)),
  }
})
