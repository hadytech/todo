<script setup lang="ts">
const config = useRuntimeConfig()

// Eight rows, not the whole directory — see the limit in /api/list.
const { data } = await useFetch('/api/list', { query: { limit: 8 } })

const q = ref('')
const router = useRouter()

function go() {
  if (q.value.trim()) router.push({ path: '/qidiruv', query: { q: q.value.trim() } })
}

const counts = computed(() => data.value?.counts)

/** Only categories and districts that have something in them. */
const liveCategories = computed(() =>
  (data.value?.categories ?? []).filter((c) => (counts.value?.categories[c.slug] ?? 0) > 0))

const liveDistricts = computed(() =>
  (data.value?.districts ?? []).filter((d) => (counts.value?.districts[d.slug] ?? 0) > 0))

const site = config.public.siteUrl as string

/**
 * WebSite + SearchAction is what lets a search engine offer this site's
 * own search box directly in the results, and Organization is what ties
 * the name to the domain. Both belong on the home page only — repeating
 * them per page is noise, not signal.
 */
const structured = [
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
    areaServed: { '@type': 'City', name: 'Toshkent' },
  },
]

useSeoMeta({
  ogType: 'website',
  ogSiteName: 'yalp.uz',
  ogLocale: 'uz_UZ',
  ogTitle: 'yalp.uz — Toşkentdagi joylar',
  ogDescription: 'Toshkentdagi restoran, kafe, gozallik saloni, universitet va bozorlar maʼlumotnomasi.',
  ogUrl: site,
  ogImage: `${site}/og.png`,
  twitterCard: 'summary_large_image',
})

useHead({
  title: 'yalp.uz — Toşkentdagi joylar',
  meta: [{
    name: 'description',
    content: 'Toshkentdagi restoran, kafe, gozallik saloni, universitet va bozorlar maʼlumotnomasi. Chorsu, Yunusobod, Chilonzor va boshqa tumanlar böyicha qidiring.',
  }],
  link: [{ rel: 'canonical', href: site }],
  script: structured.map((o) => ({ type: 'application/ld+json', innerHTML: JSON.stringify(o) })),
})
</script>

<template>
  <div>
    <section class="mb-9">
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
        Toşkentda nima qidiryapsiz?
      </h1>
      <p class="mt-2 text-muted text-pretty max-w-2xl">
        Istagan alifboda yozing — <span class="text-ink">çoyxona</span>,
        <span class="text-ink">çoyxona</span> yoki
        <span class="text-ink">чойхона</span> bir xil natija beradi.
      </p>

      <form class="mt-5 flex flex-col sm:flex-row gap-2" @submit.prevent="go">
        <input
          v-model="q"
          type="search"
          aria-label="Joy qidiriş"
          placeholder="Nom, tuman yoki turi…"
          class="flex-1 rounded-soft border border-line bg-surface px-4 py-3.5
                 placeholder:text-muted"
        >
        <button class="rounded-soft bg-accent text-accent-ink px-6 py-3.5 font-medium">
          Qidiruv
        </button>
      </form>
    </section>

    <section v-if="liveCategories.length" class="mb-9">
      <div class="tiles grid grid-cols-2 sm:grid-cols-3 gap-3">
        <NuxtLink
          v-for="c in liveCategories"
          :key="c.slug"
          :to="`/kategoriya/${c.slug}`"
          class="card rounded-soft border border-line bg-surface p-4
                 hover:border-accent hover:shadow-sm"
        >
          <span class="block text-2xl leading-none">{{ c.icon }}</span>
          <span class="mt-2 block font-medium leading-tight">{{ c.name }}</span>
          <span class="mt-0.5 block text-sm text-muted tabular-nums">
            {{ counts?.categories[c.slug] }} ta joy
          </span>
        </NuxtLink>
      </div>
    </section>

    <section v-if="liveDistricts.length" class="mb-9">
      <h2 class="text-sm font-semibold text-muted mb-2.5">Tumanlar</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="d in liveDistricts"
          :key="d.slug"
          :to="`/tuman/${d.slug}`"
          class="rounded-pill border border-line bg-surface px-3.5 py-1.5 text-sm
                 hover:border-accent"
        >{{ d.name }}<span class="ml-1.5 text-muted tabular-nums">{{ counts?.districts[d.slug] }}</span></NuxtLink>
      </div>
    </section>

    <!--
      Nothing published yet. An empty directory is the truth right now, so
      the page says so and offers the one useful action, rather than
      rendering a bare search box over nothing — which reads as broken
      rather than new.
    -->
    <section v-if="!data?.items?.length" class="rounded-soft border border-line bg-surface p-6">
      <h2 class="font-semibold">Maʼlumotnoma töldirilmoqda</h2>
      <p class="mt-1.5 text-muted text-pretty">
        Hozircha tekşirilgan joy yöq.
        <template v-if="data?.pending">
          {{ data.pending }} ta joy nomi yozib qöyilgan — manzil, telefon va iş vaqti
          tekşirilgaç, şu yerda paydo böladi.
        </template>
      </p>
      <NuxtLink
        to="/qoshish"
        class="mt-4 inline-block rounded-soft bg-accent text-accent-ink px-5 py-2.5 font-medium"
      >Joy qöşiş</NuxtLink>
    </section>

    <section v-if="data?.items?.length">
      <div class="flex items-baseline justify-between mb-2.5">
        <h2 class="text-sm font-semibold text-muted">Joylar</h2>
        <span class="text-sm text-muted tabular-nums">{{ data.total }} ta</span>
      </div>

      <!-- One column on a phone, two once there is room. -->
      <div class="grid gap-3 sm:grid-cols-2">
        <BusinessCard v-for="b in data.items" :key="b.slug" :business="b" />
      </div>

      <NuxtLink
        v-if="data.total > data.items.length"
        to="/qidiruv"
        class="inline-block mt-4 text-sm text-accent"
      >Hammasini köriş →</NuxtLink>
    </section>
  </div>
</template>

<style scoped>
/**
 * With an odd number of categories the last tile would sit alone in a
 * half-empty row, which reads as a layout bug rather than a choice. At
 * two columns it stretches to fill the row instead; at three columns the
 * browser handles it, so the rule is scoped to the narrow layout.
 */
@media (max-width: 639px) {
  .tiles > :last-child:nth-child(odd) { grid-column: span 2; }
}
</style>
