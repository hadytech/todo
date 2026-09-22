import tailwindcss from '@tailwindcss/vite'
import { loadBusinesses, loadCategories, publishedOnly } from './lib/load'

const { businesses } = loadBusinesses()
const published = publishedOnly(businesses)
const categories = loadCategories()

/**
 * Category x district landing pages. These are the pages that actually
 * rank in search, and they cost one template — so they are prerendered
 * from day one rather than bolted on later.
 */
const landingRoutes = categories.flatMap((c) =>
  [...new Set(published.filter((b) => b.categoryTop === c.slug).map((b) => b.district))]
    .map((d) => `/toshkent/${d}/${c.slug}`),
)

/**
 * One index per district that actually has listings. These sit above the
 * category x district pages and give every business page a parent worth
 * linking to. Empty districts are not generated: a page with nothing on
 * it is thin content and a dead end.
 */
const districtRoutes = [...new Set(published.map((b) => b.district))]
  .map((d) => `/tuman/${d}`)

/** One page per category, city-wide. */
const categoryRoutes = [...new Set(published.map((b) => b.categoryTop))]
  .map((c) => `/kategoriya/${c}`)

/**
 * Whether this is the no-server build.
 *
 * Nitro already honours NITRO_PRESET on its own; it is read here as well
 * because the prerender list and the route rules have to agree with the
 * preset, and disagreeing silently produces a build that looks fine and
 * serves stale reviews.
 */
const staticBuild = process.env.NITRO_PRESET === 'static'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: [],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  /**
   * GitHub Pages serves static files only, so everything is prerendered.
   * Set NUXT_APP_BASE_URL=/<repo>/ for a project site; leave it as "/"
   * once the custom domain is pointed here.
   */
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      htmlAttrs: { lang: 'uz' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        // Two theme-colors so the phone browser chrome matches the page
        // it is framing instead of one of them always being wrong.
        { name: 'theme-color', content: '#F6F9F7', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0E1513', media: '(prefers-color-scheme: dark)' },
        { name: 'apple-mobile-web-app-title', content: 'yalp.uz' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/icon-180.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        // Google Fonts serves the stylesheet from one host and the font
        // file from another, so both need warming or the file waits on a
        // second connection it could have opened in parallel.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          // display=swap renders the fallback immediately rather than
          // holding the text blank while the font downloads — on a slow
          // connection that is the difference between a readable page and
          // an empty one.
          href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
        },
      ],
      script: [{
        /**
         * Applies a stored theme before the first paint.
         *
         * This has to be inline and blocking. Anything deferred — a
         * bundled script, a hydration hook — runs after the browser has
         * already painted the default theme, and the visitor sees a white
         * flash before their dark theme arrives.
         */
        innerHTML:
          "try{var t=localStorage.getItem('yalp-theme');"
          + "if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
        tagPosition: 'head',
      }],
    },
  },

  nitro: {
    /**
     * Vercel by default, because reviews need somewhere to POST to and
     * GitHub Pages has nowhere.
     *
     * `NITRO_PRESET=static` still produces the old Pages build — Nitro
     * reads that variable itself, so nothing here has to be edited. That
     * build is not crippled, it is honest: with no database behind it the
     * review section renders as unavailable rather than offering a form
     * that cannot submit.
     */
    preset: staticBuild ? 'static' : 'vercel',
    prerender: {
      crawlLinks: staticBuild,
      routes: [
        '/',
        '/qidiruv',
        /**
         * Only on the static build. Both of these render differently
         * depending on whether a database is reachable, and CI has no
         * DATABASE_URL — prerendering them under Vercel would bake "the
         * form is unavailable" into the deployed page for good.
         */
        ...(staticBuild ? ['/qoshish', '/kirish'] : []),
        /**
         * Business pages carry reviews, and reviews are the content
         * people actually search for. Freezing them at build time would
         * mean a crawler only ever sees the reviews that existed when CI
         * last ran, so under Vercel they are rendered on demand and
         * cached (see routeRules) instead of prerendered.
         */
        ...(staticBuild ? published.map((b) => `/b/${b.slug}`) : []),
        ...landingRoutes,
        ...districtRoutes,
        ...categoryRoutes,
        '/sitemap.xml',
        '/robots.txt',
      ],
      // A broken internal link should fail the build, not ship.
      failOnError: true,
    },
  },

  routeRules: staticBuild ? {} : {
    /**
     * Rendered once, then served from cache for ten minutes.
     *
     * The window is the trade: a review posted now is visible to its
     * author immediately (their own request revalidates), to everyone
     * else within ten minutes, and the database is asked at most once per
     * page per window rather than once per visit. That is what keeps a
     * free Postgres tier comfortably inside its compute allowance.
     */
    '/b/**': { isr: 600 },
    // Rendered per request: a form must not be served from a cache that
    // predates the database it posts to.
    '/qoshish': { isr: false },
    '/kirish': { isr: false },
    // Writes must never be cached, by anything, ever.
    '/api/auth/**': { cache: false, headers: { 'cache-control': 'no-store' } },
    '/api/reviews/**': { cache: false, headers: { 'cache-control': 'no-store' } },
  },

  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://yalp.uz',
      /**
       * Search engines are kept out unless this is explicitly turned on.
       *
       * The default is deliberately the safe one: a directory crawled
       * while it holds a handful of placeholder listings makes its first
       * impression as a near-empty site, and early quality signals are
       * sticky. Opt in (repo variable INDEXABLE=true) once there is real
       * content worth finding.
       */
      indexable: process.env.NUXT_PUBLIC_INDEXABLE === 'true',
      /**
       * GoatCounter site code, e.g. "yalp" for yalp.goatcounter.com.
       *
       * Empty by default: nothing is loaded and no request leaves the
       * page until this is set. GoatCounter is open source, free for
       * non-commercial use, sets no cookies and collects no personal
       * data, which is why it needs no consent banner — a tracker that
       * required one would cost more in friction than the numbers are
       * worth.
       *
       * This is not optional decoration. The plan for the new alphabet is
       * to ship it, watch which spellings people actually search, and
       * flip `alphabet` if the data disagrees. Without numbers that
       * decision can never be made, only argued about.
       */
      analytics: process.env.NUXT_PUBLIC_ANALYTICS || '',
      /** google-site-verification token, for Search Console. */
      siteVerification: process.env.NUXT_PUBLIC_SITE_VERIFICATION || '',
      /** Source repository. Update here if the repo is renamed. */
      repoUrl: process.env.NUXT_PUBLIC_REPO_URL || 'https://github.com/hadytech/todo',
      /**
       * Swap this to flip the whole site between alphabets. Everything is
       * derived from one canonical form, so this is the only line that
       * changes if the data says standard Latin wins.
       */
      alphabet: process.env.NUXT_PUBLIC_ALPHABET || 'new',
      /**
       * Self-hosted Protomaps archive. Verify Range-request support on
       * GitHub Pages before relying on this URL; if Pages does not honour
       * Range, point it at a GitHub Release asset instead.
       */
      pmtilesUrl: process.env.NUXT_PUBLIC_PMTILES_URL || '/tiles/toshkent.pmtiles',
      /**
       * Label fonts for the basemap. Defaults to the Protomaps asset set
       * (open, free, GitHub Pages hosted). `npm run vendor:glyphs` copies
       * them into public/ if you would rather depend on nothing.
       */
      glyphsUrl: process.env.NUXT_PUBLIC_GLYPHS_URL
        || 'https://protomaps.github.io/basemaps-assets/fonts',
    },
  },
})
