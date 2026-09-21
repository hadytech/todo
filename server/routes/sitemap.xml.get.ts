import { catalog, lastModified } from '../utils/catalog'

export default defineEventHandler((event) => {
  const base = (useRuntimeConfig().public.siteUrl as string).replace(/\/$/, '')

  const urls = [
    { loc: '/', priority: '1.0' },
    // /qidiruv is deliberately absent — it is noindex, being thin and
    // duplicative of the pages it links to.
    { loc: '/qoshish', priority: '0.5' },
    ...catalog.businesses.map((b) => ({
      loc: `/b/${b.slug}`,
      priority: '0.8',
      lastmod: lastModified(b.slug),
    })),
    ...[...new Set(catalog.businesses.map((b) => b.district))]
      .map((d) => ({ loc: `/tuman/${d}`, priority: '0.7' })),
    ...[...new Set(catalog.businesses.map((b) => b.categoryTop))]
      .map((c) => ({ loc: `/kategoriya/${c}`, priority: '0.7' })),
    ...catalog.categories.flatMap((c) =>
      [...new Set(catalog.businesses.filter((b) => b.categoryTop === c.slug).map((b) => b.district))]
        .map((d) => ({ loc: `/toshkent/${d}/${c.slug}`, priority: '0.7' })),
    ),
  ]

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => {
  const lastmod = 'lastmod' in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''
  return `  <url><loc>${base}${u.loc}</loc>${lastmod}<priority>${u.priority}</priority></url>`
}).join('\n')}
</urlset>`
})
