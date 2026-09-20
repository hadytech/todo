/**
 * Prefixes a root-relative path with the app's baseURL.
 *
 * Nuxt rewrites paths inside <NuxtLink> and bundled assets, but not a
 * plain `src="/photos/x.avif"` or a URL built in JavaScript. On a GitHub
 * project site (baseURL "/repo/") those resolve to the domain root and
 * 404 — and only on the deployed site, never in local dev.
 */
export function useAssetUrl() {
  const base = useRuntimeConfig().app.baseURL || '/'
  return (path: string) => `${base}${path}`.replace(/\/{2,}/g, '/')
}
