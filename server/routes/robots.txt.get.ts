export default defineEventHandler((event) => {
  const config = useRuntimeConfig().public
  const base = (config.siteUrl as string).replace(/\/$/, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  // Closed by default — see `indexable` in nuxt.config.ts.
  if (!config.indexable) return 'User-agent: *\nDisallow: /\n'

  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
})
