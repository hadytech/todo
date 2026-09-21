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
        { name: 'theme-color', content: '#0f766e' },
      ],
      link: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
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
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/qidiruv',
        '/qoshish',
        ...published.map((b) => `/b/${b.slug}`),
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
