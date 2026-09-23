<script setup lang="ts">
/**
 * Category x district landing pages — the pages that actually rank.
 * One template, prerendered for every combination that has listings.
 */
const route = useRoute()
const config = useRuntimeConfig()
const { district, category } = route.params as { district: string; category: string }

const { data } = await useFetch('/api/list', { query: { district, category } })

const districtName = computed(() => data.value?.districts.find((d) => d.slug === district)?.name ?? district)
const categoryName = computed(() => data.value?.categories.find((c) => c.slug === category)?.name ?? category)

const title = computed(() => `${districtName.value} tumanidagi ${categoryName.value.toLowerCase()} — Toşkent`)

const pageUrl = `${config.public.siteUrl}/toshkent/${district}/${category}`

/**
 * ItemList tells search engines this page IS the list, rather than
 * leaving them to infer it from markup. Paired with BreadcrumbList it is
 * what earns the richer SERP treatment these pages depend on.
 */
const structured = computed(() => [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: 'yalp.uz', item: config.public.siteUrl },
      { name: districtName.value, item: `${config.public.siteUrl}/tuman/${district}` },
      { name: categoryName.value, item: pageUrl },
    ].map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, item: e.item })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title.value,
    numberOfItems: data.value?.items.length ?? 0,
    itemListElement: (data.value?.items ?? []).map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${config.public.siteUrl}/b/${b.slug}`,
      name: b.name,
    })),
  },
])

useHead({
  title: () => `${title.value} | yalp.uz`,
  script: () => structured.value.map((o) => ({
    type: 'application/ld+json',
    innerHTML: JSON.stringify(o),
  })),
  meta: [{ name: 'description', content: () =>
    `${districtName.value}, Toşkentdagi ${categoryName.value.toLowerCase()} röyxati — manzil, telefon va iş vaqti.` }],
  link: [{ rel: 'canonical', href: `${config.public.siteUrl}/toshkent/${district}/${category}` }],
  // Belt and braces: the home page no longer links empty combinations,
  // but a page that ends up empty must not be indexed as thin content.
  ...(data.value?.items.length ? {} : { meta: [{ name: 'robots', content: 'noindex' }] }),
})
</script>

<template>
  <div>
    <nav class="text-sm text-muted mb-2 flex flex-wrap gap-x-1">
      <NuxtLink to="/" class="hover:text-accent">Bosh sahifa</NuxtLink>
      <span>›</span>
      <NuxtLink :to="`/tuman/${district}`" class="hover:text-accent">{{ districtName }}</NuxtLink>
      <span>›</span>
      <span>{{ categoryName }}</span>
    </nav>

    <h1 class="text-xl font-bold mb-1">{{ title }}</h1>
    <p class="text-muted text-sm mb-5">{{ data?.items.length ?? 0 }} ta joy</p>

    <div class="grid gap-3 sm:grid-cols-2">
      <BusinessCard v-for="b in data?.items" :key="b.slug" :business="b" />
    </div>

    <p v-if="!data?.items.length" class="text-muted text-sm">
      Bu tumanda hali joy qöşilmagan.
      <NuxtLink to="/qoshish" class="text-accent">Birinchi bölib qöşing</NuxtLink>.
    </p>
  </div>
</template>
