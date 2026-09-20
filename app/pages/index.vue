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

useSeoMeta({
  ogType: 'website',
  ogSiteName: 'yalp.uz',
  ogLocale: 'uz_UZ',
  ogTitle: 'yalp.uz — Toşkentdagi joylar',
  ogDescription: 'Toshkentdagi restoran, kafe, gozallik saloni va klinikalar maʼlumotnomasi.',
  ogUrl: config.public.siteUrl as string,
  ogImage: `${config.public.siteUrl}/og.png`,
  twitterCard: 'summary_large_image',
})

useHead({
  title: 'yalp.uz — Toşkentdagi joylar',
  meta: [{
    name: 'description',
    content: 'Toshkentdagi restoran, kafe, gozallik saloni va klinikalar maʼlumotnomasi. Chorsu, Yunusobod, Chilonzor va boshqa tumanlar.',
  }],
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-1">Toşkentda nima qidiryapsiz?</h1>
    <p class="opacity-70 text-sm mb-4">
      Istagan alifboda yozing — <span class="font-medium">çoyxona</span>,
      <span class="font-medium">choyxona</span> yoki
      <span class="font-medium">чойхона</span> bir xil natija beradi.
    </p>

    <form class="flex gap-2 mb-8" @submit.prevent="go">
      <input
        v-model="q"
        type="search"
        aria-label="Joy qidiriş"
        placeholder="Nom, tuman yoki turi…"
        class="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 bg-transparent"
      >
      <button class="rounded-lg bg-teal-600 text-white px-5 font-medium">Qidiruv</button>
    </form>

    <!-- Three tiles, not three sections of district chips. Each is a
         whole-city category page; narrowing to a tuman happens there. -->
    <section v-if="liveCategories.length" class="mb-8">
      <div class="grid grid-cols-3 gap-2">
        <NuxtLink
          v-for="c in liveCategories"
          :key="c.slug"
          :to="`/kategoriya/${c.slug}`"
          class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3
                 hover:border-teal-600 flex flex-col gap-1"
        >
          <span class="text-xl leading-none">{{ c.icon }}</span>
          <span class="font-medium text-sm leading-tight">{{ c.name }}</span>
          <span class="text-xs opacity-55 tabular-nums">{{ counts?.categories[c.slug] }} ta</span>
        </NuxtLink>
      </div>
    </section>

    <section v-if="liveDistricts.length" class="mb-8">
      <h2 class="text-sm font-semibold opacity-70 mb-2">Tumanlar</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="d in liveDistricts"
          :key="d.slug"
          :to="`/tuman/${d.slug}`"
          class="text-sm rounded-full border border-neutral-300 dark:border-neutral-700
                 px-3 py-1 hover:border-teal-600"
        >{{ d.name }}<span class="ml-1 opacity-45 tabular-nums">{{ counts?.districts[d.slug] }}</span></NuxtLink>
      </div>
    </section>

    <section v-if="data?.items?.length">
      <div class="flex items-baseline justify-between mb-2">
        <h2 class="text-sm font-semibold opacity-70">Joylar</h2>
        <span class="text-sm opacity-55 tabular-nums">{{ data.total }} ta</span>
      </div>
      <BusinessCard v-for="b in data.items" :key="b.slug" :business="b" />
      <NuxtLink
        v-if="data.total > data.items.length"
        to="/qidiruv"
        class="inline-block mt-3 text-sm text-teal-600 dark:text-teal-400"
      >Hammasini koʻriş →</NuxtLink>
    </section>
  </div>
</template>
