import { catalog } from '../utils/catalog'

export default defineEventHandler((event) => {
  const base = (useRuntimeConfig().public.siteUrl as string).replace(/\/$/, '')

  const urls = [
    { loc: '/', priority: '1.0' },
    ...catalog.businesses.map((b) => ({ loc: `/b/${b.slug}`, priority: '0.8' })),
    ...catalog.categories.flatMap((c) =>
      [...new Set(catalog.businesses.filter((b) => b.categoryTop === c.slug).map((b) => b.district))]
        .map((d) => ({ loc: `/toshkent/${d}/${c.slug}`, priority: '0.7' })),
    ),
  ]

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`
})
