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

const markers = computed(() =>
  results.value.map((r) => ({ lat: r.lat, lng: r.lng, name: r.name, slug: r.id })))

async function run() {
  const term = q.value.trim()
  router.replace({ query: term ? { q: term } : {} })
  if (!term) { results.value = []; return }

  loading.value = true
  const index = await load()
  ready.value = true
  results.value = index.search(term).slice(0, 50) as never
  loading.value = false
}

// Index loads on first interaction, never on page load.
watch(q, run)
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
      autofocus
      placeholder="Nom, tuman yoki turi…"
      class="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 bg-transparent mb-4"
    >

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

    <p v-else-if="q.trim() && ready && !results.length" class="opacity-70 text-sm">
      Hech narsa topilmadi. Boşqaça yozib koʻring — istagan alifbo işlaydi.
    </p>

    <MapView v-else-if="view === 'map'" :key="results.length" :markers="markers" height="24rem" />

    <ul v-else>
      <li v-for="r in results" :key="r.id">
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
