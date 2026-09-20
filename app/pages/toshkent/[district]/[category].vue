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

useHead({
  title: () => `${title.value} | yalp.uz`,
  meta: [{ name: 'description', content: () =>
    `${districtName.value}, Toşkentdagi ${categoryName.value.toLowerCase()} roʻyxati — manzil, telefon va iş vaqti.` }],
  link: [{ rel: 'canonical', href: `${config.public.siteUrl}/toshkent/${district}/${category}` }],
  // Belt and braces: the home page no longer links empty combinations,
  // but a page that ends up empty must not be indexed as thin content.
  ...(data.value?.items.length ? {} : { meta: [{ name: 'robots', content: 'noindex' }] }),
})
</script>

<template>
  <div>
    <h1 class="text-xl font-bold mb-1">{{ title }}</h1>
    <p class="opacity-70 text-sm mb-5">{{ data?.items.length ?? 0 }} ta joy</p>

    <BusinessCard v-for="b in data?.items" :key="b.slug" :business="b" />

    <p v-if="!data?.items.length" class="opacity-70 text-sm">
      Bu tumanda hali joy qoʻşilmagan.
      <a href="https://github.com/hadytech/todo" rel="noopener" class="text-teal-600 dark:text-teal-400">
        Birinchi boʻlib qoʻşing
      </a>.
    </p>
  </div>
</template>
