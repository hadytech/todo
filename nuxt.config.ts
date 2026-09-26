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
        /**
         * No webfont.
         *
         * Manrope used to come from Google Fonts, which meant every
         * visitor's browser told Google they had opened yalp.uz — before
         * a single word of the page was readable, on every page, with no
         * way to decline. That is not a small thing to hand a third party
         * in exchange for letterforms, and it is not something a privacy
         * page can explain away.
         *
         * So the site asks for nothing off-origin at all (see
         * /maxfiylik), and the type comes from the device. On a Tashkent
         * phone the system stack also renders immediately, with no swap
         * and no download, which is worth more on a slow connection than
         * any particular set of curves.
         *
         * `scripts/vendor-font.sh` self-hosts Manrope for anyone who
         * wants it back; self-hosted is the only acceptable way to have
         * it, and that script needs network access this build does not
         * have.
         */
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
        // Static text on every preset: it depends on nothing at runtime,
        // and a page that explains what the site stores should be the one
        // page that cannot fail to load.
        '/maxfiylik',
        /**
         * Only on the static build. Both of these render differently
         * depending on whether a database is reachable, and CI has no
         * DATABASE_URL — prerendering them under Vercel would bake "the
         * form is unavailable" into the deployed page for good.
         */
        ...(staticBuild ? ['/qoshish', '/kirish'] : []),
        /**
         * Prerendered on every preset.
         *
         * These were rendered on demand under Vercel so that review text
         * would be in the HTML rather than frozen at build time. That is
         * the right shape once reviews exist — but there is no database
         * connected yet, so on-demand rendering buys nothing today and
         * costs a whole class of failure: a page that depends on a
         * function being routed correctly can 404, and a file cannot.
         *
         * Put the `isr` rule back alongside DATABASE_URL.
         */
        ...published.map((b) => `/b/${b.slug}`),
        /**
         * The API routes, written out as files.
         *
         * A prerendered page normally gets its data from
         * `_payload.json`, which is keyed by build id. When that misses
         * — a tab open across a deploy, a CDN still serving the
         * previous index.html — `useFetch` falls through to the real
         * route, and on a static host there was nothing there. The
         * business page then threw its own 404, so a listing that
         * existed reported itself missing.
         *
         * Prerendering these means the fallback resolves: stale data
         * for a moment instead of a dead page.
         */
        ...(staticBuild
          // A static host ignores the query string, so only the bare
          // routes are worth writing: /api/list?category=x would be
          // served the same file as /api/list. The filtered browse
          // pages fall back to the unfiltered list rather than to a
          // dead page, which is the trade.
          ? ['/api/facets', '/api/list', ...published.map((b) => `/api/business/${b.slug}`)]
          : []),
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

  /**
   * Headers, on every response from the server preset.
   *
   * These are the cheap half of "secure": they cost nothing, they are
   * invisible when nothing is wrong, and each one closes a specific hole.
   *
   * The static preset cannot set them — a static host serves files and
   * has no place to put a header — which is one more reason the server
   * build is the one DNS points at. `_headers` would cover Netlify and
   * Cloudflare Pages but not GitHub Pages, so it is not written here as a
   * second half-measure that looks like coverage.
   */
  routeRules: staticBuild ? {} : {
    /**
     * Applied to everything the server renders.
     *
     * The CSP is the load-bearing one. `script-src 'self' 'unsafe-inline'`
     * is not the strong version — Nuxt hydration ships an inline payload
     * script and a nonce would have to be threaded through the render —
     * but it still means a stored string cannot pull executable code from
     * another origin, which is what a review-body injection would need.
     * Tightening it to a nonce is worth doing and is a separate change.
     *
     * `frame-ancestors 'none'` and `form-action 'self'` are the ones that
     * matter for the write endpoints: nothing may frame this site to
     * clickjack a rating out of somebody, and no form on this page may
     * post anywhere else.
     */
    '/**': {
      headers: {
        'content-security-policy': [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          /**
           * `data:` because a photo a visitor picks is previewed from a
           * data URL and stored photos are data URLs. `blob:` because
           * MapLibre decodes tiles into blobs — leaving it out does not
           * produce an error message, it produces a blank map, which is
           * the kind of regression a CSP is famous for.
           */
          "img-src 'self' data: blob:",
          "script-src 'self' 'unsafe-inline'",
          // MapLibre runs its tile decoding in a worker it creates from a
          // blob. Same story: omit this and the map silently dies.
          "worker-src 'self' blob:",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self'",
          // No third party is contacted, so nothing needs to be allowed
          // beyond this origin. See /maxfiylik.
          "connect-src 'self'",
        ].join('; '),
        // No MIME sniffing: a stored file must be treated as the type it
        // was served with, never as one a browser guessed.
        'x-content-type-options': 'nosniff',
        // Leaving this site should not tell the next one which listing
        // was being read. Origin-only on cross-origin navigation.
        'referrer-policy': 'strict-origin-when-cross-origin',
        // Nothing here needs any of these, and a page that cannot ask
        // cannot be tricked into asking.
        'permissions-policy': 'geolocation=(), camera=(), microphone=(), payment=()',
      },
    },
    /**
     * Rendered once, then served from cache for ten minutes.
     *
     * The window is the trade: a review posted now is visible to its
     * author immediately (their own request revalidates), to everyone
     * else within ten minutes, and the database is asked at most once per
     * page per window rather than once per visit. That is what keeps a
     * free Postgres tier comfortably inside its compute allowance.
     */
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
       * Telegram account or channel that accepts place suggestions,
       * without the @.
       *
       * This is what makes /qoshish usable on a build with no server:
       * the form still collects everything and hands the visitor a
       * ready-made message. Telegram rather than email because in
       * Tashkent it is the channel people actually have — the whole
       * point of the form is that requiring a GitHub account loses the
       * person who knows which barber is good, and requiring anything
       * else they do not use loses them just as surely.
       */
      telegram: process.env.NUXT_PUBLIC_TELEGRAM || '',
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
