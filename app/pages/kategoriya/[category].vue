<script setup lang="ts">
/**
 * City-wide category page — every restaurant in Toşkent, not just the
 * ones in one tuman.
 *
 * This completes the browse grid. Without it the home page had to list
 * every district under every category to reach anything, which is what
 * made it dense: three category sections of chips plus a district
 * section, all before the first listing.
 *
 *   /kategoriya/<cat>              one category, whole city
 *   /tuman/<district>              one district, all categories
 *   /<city>/<district>/<cat>       the intersection
 */
const route = useRoute()
const config = useRuntimeConfig()
const category = route.params.category as string

/**
 * `?shahar=` chooses the city; without it, the default one.
 *
 * A query parameter rather than a path segment because this page is
 * prerendered per category, and a static host serves the same file
 * whatever the query — so the city is resolved on the client after
 * hydration. That is acceptable here and would not be on the feed: a
 * category page opens from a link that already named the city.
 */
const route2 = useRoute()
const city = computed(() => String(route2.query.shahar ?? '') || undefined)

const { data } = await useFetch('/api/list', {
  query: { category, city },
  key: () => `kategoriya-${category}-${city.value ?? 'default'}`,
})

const categoryName = computed(() =>
  data.value?.categories.find((c) => c.slug === category)?.name ?? category)

/** Grouped by district, in catalogue order. */
const groups = computed(() =>
  (data.value?.districts ?? [])
    .map((d) => ({ ...d, items: (data.value?.items ?? []).filter((b) => b.districtName === d.name) }))
    .filter((g) => g.items.length))

const total = computed(() => data.value?.items.length ?? 0)
const pageUrl = `${config.public.siteUrl}/kategoriya/${category}`
const title = computed(() => `Toşkentdagi ${categoryName.value.toLowerCase()}`)

const structured = computed(() => [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { name: 'yalp.uz', item: config.public.siteUrl },
      { name: categoryName.value, item: pageUrl },
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
    content: () => `Toshkentdagi ${categoryName.value.toLowerCase()} — manzil, telefon va iş vaqti, tuman böyiça.`,
  }],
  link: [{ rel: 'canonical', href: pageUrl }],
  script: () => structured.value.map((o) => ({
    type: 'application/ld+json',
    innerHTML: JSON.stringify(o),
  })),
})
</script>

<template>
  <div class="px-4 py-4">
    <nav class="text-sm text-muted mb-2 flex flex-wrap gap-x-1">
      <NuxtLink to="/" class="hover:text-accent">Boş sahifa</NuxtLink>
      <span>›</span>
      <span>{{ categoryName }}</span>
    </nav>

    <h1 class="text-xl font-bold mb-1">{{ title }}</h1>
    <p class="text-muted text-sm mb-6">{{ total }} ta joy</p>

    <section v-for="g in groups" :key="g.slug" class="mb-8">
      <div class="flex items-baseline justify-between mb-2">
        <h2 class="font-semibold">{{ g.name }}</h2>
        <NuxtLink
          :to="`/${g.city}/${g.slug}/${category}`"
          class="text-sm text-accent"
        >Hammasi ({{ g.items.length }})</NuxtLink>
      </div>
      <div class="-mx-4">
        <FeedRow v-for="b in g.items.slice(0, 4)" :key="b.slug" :business="b" />
        </div>
    </section>

    <p v-if="!groups.length" class="text-muted text-sm">
      Bu turdagi joy hali qöşilmagan.
      <NuxtLink to="/qoshish" class="text-accent">Birinçi bölib qöşing</NuxtLink>.
    </p>
  </div>
</template>
