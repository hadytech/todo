<script setup lang="ts">
/**
 * District index — every listing in one tuman, grouped by category.
 *
 * Sits between the home page and the category x district landing pages,
 * so each business page has a parent worth linking to and the browse
 * surface is a real hierarchy rather than a flat list of leaves.
 */
const route = useRoute()
const config = useRuntimeConfig()
const district = route.params.district as string

const { data } = await useFetch('/api/list', { query: { district } })

const districtName = computed(() =>
  data.value?.districts.find((d) => d.slug === district)?.name ?? district)

/** Category groups in the order they appear in data/categories.yaml. */
const groups = computed(() =>
  (data.value?.categories ?? [])
    .map((c) => ({
      ...c,
      items: (data.value?.items ?? []).filter((b) => b.categoryTop === c.slug),
    }))
    .filter((g) => g.items.length))

const total = computed(() => data.value?.items.length ?? 0)
const pageUrl = `${config.public.siteUrl}/tuman/${district}`
const title = computed(() => `${districtName.value} tumanidagi joylar — Toşkent`)

const structured = computed(() => [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: 'yalp.uz', item: config.public.siteUrl },
      { name: districtName.value, item: pageUrl },
    ].map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, item: e.item })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title.value,
    numberOfItems: total.value,
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
  meta: [{
    name: 'description',
    content: () => `${districtName.value}, Toşkentdagi restoran, kafe, gözallik saloni va klinikalar — manzil, telefon va iş vaqti.`,
  }],
  link: [{ rel: 'canonical', href: pageUrl }],
  script: () => structured.value.map((o) => ({
    type: 'application/ld+json',
    innerHTML: JSON.stringify(o),
  })),
})
</script>

<template>
  <div>
    <nav class="text-sm text-muted mb-2">
      <NuxtLink to="/" class="hover:opacity-100">Bosh sahifa</NuxtLink>
      <span class="mx-1">›</span>
      <span>{{ districtName }}</span>
    </nav>

    <h1 class="text-xl font-bold mb-1">{{ title }}</h1>
    <p class="text-muted text-sm mb-6">{{ total }} ta joy</p>

    <section v-for="g in groups" :key="g.slug" class="mb-8">
      <div class="flex items-baseline justify-between mb-2">
        <h2 class="font-semibold">{{ g.icon }} {{ g.name }}</h2>
        <NuxtLink
          :to="`/toshkent/${district}/${g.slug}`"
          class="text-sm text-accent"
        >Hammasi ({{ g.items.length }})</NuxtLink>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <BusinessCard v-for="b in g.items.slice(0, 5)" :key="b.slug" :business="b" />
      </div>
    </section>

    <p v-if="!groups.length" class="text-muted text-sm">
      Bu tumanda hali joy qoʻşilmagan.
      <NuxtLink to="/qoshish" class="text-accent">Birinchi boʻlib qoʻşing</NuxtLink>.
    </p>
  </div>
</template>
