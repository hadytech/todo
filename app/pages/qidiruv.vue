<script setup lang="ts">
import type { IndexedBusiness } from '../../lib/search'
import { distanceMetres, formatDistance, inTashkent, type Point } from '../../lib/geo'

const route = useRoute()
const router = useRouter()
const { load } = useSearchIndex()

const q = ref(String(route.query.q ?? ''))
const results = ref<(IndexedBusiness & { id: string })[]>([])
const loading = ref(false)
const ready = ref(false)
const view = ref<'list' | 'map'>('list')

const { data: facets } = await useFetch('/api/facets')

/**
 * "Near me" is strictly opt-in — geolocation is only ever requested on an
 * explicit tap, never on page load. The position stays in memory: it is
 * not stored, not put in the URL and never leaves the browser.
 */
const here = ref<Point | null>(null)
const locating = ref(false)
const locateError = ref('')

function locate() {
  if (!navigator.geolocation) {
    locateError.value = 'Brauzeringiz joylaşuvni qoʻllab-quvvatlamaydi.'
    return
  }
  locating.value = true
  locateError.value = ''
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      // Sorting a Tashkent directory by distance from another city is
      // just a slow alphabetical shuffle — say so instead.
      if (!inTashkent(p)) {
        locateError.value = 'Siz Toşkentdan tapqaridasiz — masofa boʻyicha saralaş oʻçirildi.'
        return
      }
      here.value = p
    },
    (err) => {
      locating.value = false
      locateError.value = err.code === err.PERMISSION_DENIED
        ? 'Joylaşuvga ruxsat berilmadi.'
        : 'Joylaşuvni aniqlab boʻlmadi.'
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
  )
}
const district = ref(String(route.query.tuman ?? ''))
const category = ref(String(route.query.kat ?? ''))

/**
 * Filters narrow an existing query rather than browsing on their own —
 * browsing by category and district is what the /toshkent/... landing
 * pages are for, and they are prerendered and indexable.
 *
 * Matching is on the display name because that is what the index stores.
 */
const shown = computed(() => {
  const filtered = results.value.filter((r) => {
    const d = facets.value?.districts.find((x) => x.slug === district.value)?.name
    const c = facets.value?.categories.find((x) => x.slug === category.value)?.name
    return (!d || r.district === d) && (!c || r.category.startsWith(c))
  })

  const from = here.value
  if (!from) return filtered.map((r) => ({ ...r, metres: null as number | null }))

  // With a position, distance replaces relevance as the sort key — that
  // is the whole point of asking for it.
  return filtered
    .map((r) => ({ ...r, metres: distanceMetres(from, { lat: r.lat, lng: r.lng }) }))
    .sort((a, b) => a.metres! - b.metres!)
})

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
      <button
        type="button"
        class="rounded-lg border px-3 py-1"
        :class="here
          ? 'border-teal-600 text-teal-600'
          : 'border-neutral-300 dark:border-neutral-700 opacity-80'"
        :disabled="locating"
        @click="here ? (here = null) : locate()"
      >{{ locating ? 'Aniqlanmoqda…' : here ? '✓ Yaqinimdagi' : 'Yaqinimdagi' }}</button>

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

    <p v-if="locateError" class="text-sm opacity-70 mb-3">{{ locateError }}</p>

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
          <div class="text-sm opacity-70">
            {{ r.category }} · {{ r.district }}
            <span v-if="r.metres !== null" class="text-teal-600 dark:text-teal-400">
              · {{ formatDistance(r.metres) }}
            </span>
          </div>
          <div class="text-sm opacity-55">{{ r.address }}</div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
