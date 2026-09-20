<script setup lang="ts">
const { data } = await useFetch('/api/list')
const q = ref('')
const router = useRouter()

/** Only surface district pages that have something on them. */
function districtsWith(category: string) {
  const combos = new Set(data.value?.combos ?? [])
  return (data.value?.districts ?? []).filter((d) => combos.has(`${d.slug}/${category}`))
}

/** Districts that have at least one listing, in catalogue order. */
const activeDistricts = computed(() => {
  const live = new Set((data.value?.combos ?? []).map((c) => c.split('/')[0]))
  return (data.value?.districts ?? []).filter((d) => live.has(d.slug))
})

function go() {
  if (q.value.trim()) router.push({ path: '/qidiruv', query: { q: q.value.trim() } })
}

const config = useRuntimeConfig()

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
    content: 'Toşkentdagi restoran, kafe, gözallik saloni va klinikalar maʼlumotnomasi. Chorsu, Yunusobod, Chilonzor va boshqa tumanlar.',
  }],
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-1">Toşkentda nima qidiryapsiz?</h1>
    <p class="opacity-70 text-sm mb-5">
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

    <section v-for="c in data?.categories" :key="c.slug" class="mb-7">
      <h2 class="font-semibold mb-2">{{ c.icon }} {{ c.name }}</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="d in districtsWith(c.slug)"
          :key="d.slug"
          :to="`/toshkent/${d.slug}/${c.slug}`"
          class="text-sm rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1 hover:border-teal-600"
        >{{ d.name }}</NuxtLink>
        <span v-if="!districtsWith(c.slug).length" class="text-sm opacity-50">hali joy yoʻq</span>
      </div>
    </section>

    <section v-if="activeDistricts.length" class="mb-7">
      <h2 class="font-semibold mb-2">Tumanlar boʻyicha</h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="d in activeDistricts"
          :key="d.slug"
          :to="`/tuman/${d.slug}`"
          class="text-sm rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-1 hover:border-teal-600"
        >{{ d.name }}</NuxtLink>
      </div>
    </section>

    <section v-if="data?.items?.length">
      <div class="flex items-baseline justify-between mb-3">
        <h2 class="font-semibold">Joylar</h2>
        <span class="text-sm opacity-60">{{ data.total }} ta</span>
      </div>
      <BusinessCard v-for="b in data.items.slice(0, 8)" :key="b.slug" :business="b" />
      <NuxtLink
        v-if="data.total > 8"
        to="/qidiruv"
        class="inline-block mt-3 text-sm text-teal-600 dark:text-teal-400"
      >Hammasini koʻriş →</NuxtLink>
    </section>
  </div>
</template>
