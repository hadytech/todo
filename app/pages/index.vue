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

/** Category icon per row, so a listing without a photo still has a mark. */
const iconFor = (slug: string) =>
  (data.value?.categories ?? []).find((c) => c.slug === slug)?.icon

const feed = computed(() =>
  (data.value?.items ?? []).map((b) => ({ ...b, icon: iconFor(b.categoryTop) })))

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
    <!-- The column header. Sticky under the phone bar, at the top on
         desktop where the rail carries the branding instead. -->
    <div
      class="sticky top-14 lg:top-0 z-20 border-b border-line bg-canvas/85 px-4 py-3
             backdrop-blur"
    >
      <h1 class="text-lg font-bold">Lenta</h1>
    </div>

    <!-- The composer. A timeline opens with an invitation to add to it. -->
    <NuxtLink
      to="/qoshish"
      class="flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-raised/40"
    >
      <span
        class="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-accent-soft
               text-xl text-accent"
        aria-hidden="true"
      >+</span>
      <span class="text-muted">Bir joyni qöşasizmi?</span>
      <span
        class="ml-auto shrink-0 rounded-pill bg-accent px-4 py-1.5 text-sm font-bold
               text-accent-ink"
      >Qöşiş</span>
    </NuxtLink>

    <!--
      Nothing published yet. An empty timeline is the truth right now, so
      it says so in the shape of a row rather than leaving a blank
      column, which reads as broken rather than new.
    -->
    <div v-if="!feed.length" class="border-b border-line px-4 py-8">
      <h2 class="font-semibold">Maʼlumotnoma töldirilmoqda</h2>
      <p class="mt-1.5 text-muted text-pretty">
        Hozirça tekşirilgan joy yöq.
        <template v-if="data?.pending">
          {{ data.pending }} ta joy nomi yozib qöyilgan — manzil, telefon va iş vaqti
          tekşirilgaç, şu yerda paydo böladi.
        </template>
      </p>
    </div>

    <FeedRow v-for="b in feed" :key="b.slug" :business="b" />

    <NuxtLink
      v-if="data?.total && data.total > feed.length"
      to="/qidiruv"
      class="block border-b border-line px-4 py-4 text-accent hover:bg-raised/40"
    >Hammasini köriş ({{ data.total }} ta)</NuxtLink>

    <!-- Browsing, below the fold. On a phone this is the only place the
         categories and districts appear at all. -->
    <section v-if="liveCategories.length" class="border-b border-line px-4 py-4">
      <h2 class="mb-3 text-sm font-semibold text-muted">Turlari böyiça</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="c in liveCategories"
          :key="c.slug"
          :to="`/kategoriya/${c.slug}`"
          class="rounded-pill border border-line px-3.5 py-1.5 text-sm hover:border-accent"
        >
          <span aria-hidden="true">{{ c.icon }}</span>
          {{ c.name }}
          <span class="ml-1 text-muted tabular-nums">{{ counts?.categories[c.slug] }}</span>
        </NuxtLink>
      </div>
    </section>

    <section v-if="liveDistricts.length" class="border-b border-line px-4 py-4">
      <h2 class="mb-3 text-sm font-semibold text-muted">Tumanlar</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="d in liveDistricts"
          :key="d.slug"
          :to="`/tuman/${d.slug}`"
          class="rounded-pill border border-line px-3.5 py-1.5 text-sm hover:border-accent"
        >{{ d.name }}<span class="ml-1.5 text-muted tabular-nums">{{ counts?.districts[d.slug] }}</span></NuxtLink>
      </div>
    </section>

    <!-- The phone has no right rail, so search lives here too. -->
    <div class="xl:hidden border-b border-line px-4 py-4">
      <SideSearch />
    </div>
  </div>
</template>
