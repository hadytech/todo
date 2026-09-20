<script setup lang="ts">
import type { IndexedBusiness } from '../../lib/search'

const route = useRoute()
const router = useRouter()
const { load } = useSearchIndex()

const q = ref(String(route.query.q ?? ''))
const results = ref<(IndexedBusiness & { id: string })[]>([])
const loading = ref(false)
const ready = ref(false)
const view = ref<'list' | 'map'>('list')

const { data: facets } = await useFetch('/api/facets')
const district = ref(String(route.query.tuman ?? ''))
const category = ref(String(route.query.kat ?? ''))

/**
 * Filters narrow an existing query rather than browsing on their own —
 * browsing by category and district is what the /toshkent/... landing
 * pages are for, and they are prerendered and indexable.
 *
 * Matching is on the display name because that is what the index stores.
 */
const shown = computed(() => results.value.filter((r) => {
  const d = facets.value?.districts.find((x) => x.slug === district.value)?.name
  const c = facets.value?.categories.find((x) => x.slug === category.value)?.name
  return (!d || r.district === d) && (!c || r.category.startsWith(c))
}))

const markers = computed(() =>
  shown.value.map((r) => ({ lat: r.lat, lng: r.lng, name: r.name, slug: r.id })))

async function run() {
  const term = q.value.trim()
  router.replace({ query: {
    ...(term ? { q: term } : {}),
    ...(district.value ? { tuman: district.value } : {}),
    ...(category.value ? { kat: category.value } : {}),
  } })
  if (!term) { results.value = []; return }

  loading.value = true
  const index = await load()
  ready.value = true
  results.value = index.search(term).slice(0, 50) as never
  loading.value = false
}

// Index loads on first interaction, never on page load.
watch(q, run)
// Filters only reshape results already in hand, so they need no re-search
// — just keep the URL shareable.
watch([district, category], () => run())
onMounted(() => { if (q.value) run() })

useHead({
  title: 'Qidiruv — yalp.uz',
  // Search result pages are thin and duplicative; keeping them out of the
  // index concentrates ranking on the business and landing pages.
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <div>
    <input
      v-model="q"
      type="search"
      aria-label="Joy qidiriş"
      autofocus
      placeholder="Nom, tuman yoki turi…"
      class="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 bg-transparent mb-4"
    >

    <div v-if="results.length" class="flex flex-wrap gap-2 mb-3 text-sm">
      <select
        v-model="category"
        aria-label="Turi boʻyicha filtr"
        class="rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1 bg-transparent"
      >
        <option value="">Hamma turi</option>
        <option v-for="c in facets?.categories" :key="c.slug" :value="c.slug">{{ c.name }}</option>
      </select>
      <select
        v-model="district"
        aria-label="Tuman boʻyicha filtr"
        class="rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1 bg-transparent"
      >
        <option value="">Hamma tuman</option>
        <option v-for="d in facets?.districts" :key="d.slug" :value="d.slug">{{ d.name }}</option>
      </select>
    </div>

    <div v-if="results.length" class="flex gap-1 mb-3 text-sm">
      <button
        v-for="v in (['list', 'map'] as const)"
        :key="v"
        type="button"
        class="px-3 py-1 rounded-full border"
        :class="view === v
          ? 'border-teal-600 text-teal-600'
          : 'border-neutral-300 dark:border-neutral-700 opacity-70'"
        @click="view = v"
      >{{ v === 'list' ? 'Roʻyxat' : 'Xarita' }}</button>
    </div>

    <p v-if="loading" class="opacity-60 text-sm">Qidirilmoqda…</p>

    <p v-else-if="q.trim() && ready && !shown.length" class="opacity-70 text-sm">
      <template v-if="results.length">
        Filtrga mos joy yoʻq. Filtrni kengaytirib koʻring.
      </template>
      <template v-else>
        Hech narsa topilmadi. Boşqaça yozib koʻring — istagan alifbo işlaydi.
      </template>
    </p>

    <MapView v-else-if="view === 'map'" :key="shown.length" :markers="markers" height="24rem" />

    <ul v-else>
      <li v-for="r in shown" :key="r.id">
        <NuxtLink
          :to="`/b/${r.id}`"
          class="block py-3 border-b border-neutral-200 dark:border-neutral-800 hover:opacity-80"
        >
          <div class="font-medium">{{ r.name }}</div>
          <div class="text-sm opacity-70">{{ r.category }} · {{ r.district }}</div>
          <div class="text-sm opacity-55">{{ r.address }}</div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
