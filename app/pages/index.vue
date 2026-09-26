<script setup lang="ts">
/**
 * The home page: the default city's timeline.
 *
 * `/` rather than `/toshkent` so the site has one canonical front door.
 * Every other city lives at `/<slug>` and is rendered by the same
 * component with one prop changed — see app/pages/[city]/index.vue.
 */
const config = useRuntimeConfig()
const site = config.public.siteUrl as string

const { data: facets } = await useFetch('/api/facets')
const cityNames = computed(() =>
  (facets.value?.cities ?? []).map((c) => c.name).join(', '))

/**
 * WebSite + SearchAction is what lets a search engine offer this site's
 * own search box directly in the results, and Organization is what ties
 * the name to the domain. Both belong on the home page only — repeating
 * them per page is noise, not signal.
 */
const structured = computed(() => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'yalp.uz',
    alternateName: ['yalp uz', 'yalp'],
    url: site,
    inLanguage: 'uz',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site}/qidiruv?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'yalp.uz',
    url: site,
    logo: `${site}/og.png`,
    // Every place the directory covers, not just the one it started in.
    areaServed: (facets.value?.cities ?? []).map((c) => ({
      '@type': 'AdministrativeArea',
      name: c.name,
    })),
  },
])

const description = computed(() =>
  `${cityNames.value || 'Toşkent'} — restoran, kafe, gözallik saloni, universitet va `
  + 'bozorlar maʼlumotnomasi. Hisobsiz baho va şarh yozing.')

useSeoMeta({
  ogType: 'website',
  ogSiteName: 'yalp.uz',
  ogLocale: 'uz_UZ',
  ogTitle: 'yalp.uz — Toşkent va Xorazmdagi joylar',
  ogDescription: description,
  ogUrl: site,
  ogImage: `${site}/og.png`,
  twitterCard: 'summary_large_image',
})

useHead({
  title: 'yalp.uz — Toşkent va Xorazmdagi joylar',
  meta: [{ name: 'description', content: description }],
  link: [{ rel: 'canonical', href: site }],
  script: computed(() => structured.value.map((o) => ({
    type: 'application/ld+json',
    innerHTML: JSON.stringify(o),
  }))),
})
</script>

<template>
  <CityFeed />
</template>
