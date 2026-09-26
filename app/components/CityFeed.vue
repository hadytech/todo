<script setup lang="ts">
/**
 * The timeline for one city.
 *
 * Extracted from the home page when Khorezm arrived: `/` and `/<city>`
 * are two routes showing the same thing about different places, and the
 * alternative — a second page file with the same hundred lines — is two
 * pages that drift apart on the first change to either.
 *
 * `city` is undefined on `/`, which the API reads as the default city.
 * Keeping it undefined rather than resolving it here is what lets `/`
 * stay the canonical home rather than a synonym for `/toshkent`.
 */
const props = defineProps<{ city?: string }>()

// Eight rows, not the whole directory — see the limit in /api/list.
const { data } = await useFetch('/api/list', {
  /**
   * A plain value, not `() => props.city`.
   *
   * A getter here is serialised into the query string as the function's
   * source, so the endpoint received a `city` that matches nothing: the
   * home feed rendered zero listings, both tabs rendered as unselected,
   * and the composer posted that string back and was refused. One
   * mistake, three symptoms, none of which pointed at the query.
   *
   * `city` comes from the route, so it cannot change without this
   * component being torn down and rebuilt — there is nothing to react to.
   */
  query: { limit: 8, ...(props.city ? { city: props.city } : {}) },
  /**
   * Keyed by city, or both tabs share one cached payload and the second
   * renders the first one's listings — the same payload-reuse trap that
   * made reviews invisible on prerendered pages.
   */
  key: `list-${props.city ?? 'default'}`,
})

const cities = computed(() => data.value?.cities ?? [])
const cityName = computed(() => data.value?.cityName ?? '')
/** The default city is `/`; every other city is `/<slug>`. */
const hrefFor = (slug: string) => (slug === data.value?.defaultCity ? '/' : `/${slug}`)

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

/**
 * Browse links stay inside the city being browsed.
 *
 * A category page reached from the Khorezm tab that quietly shows
 * Tashkent bakeries is worse than no link: it looks like the filter is
 * broken, and there is nothing on the page saying which city it is.
 */
const citySuffix = computed(() => (props.city ? `?shahar=${props.city}` : ''))
</script>

<template>
  <div>
    <!-- The column header. Sticky under the phone bar, at the top on
         desktop where the rail carries the branding instead. -->
    <div
      class="sticky top-14 lg:top-0 z-20 border-b border-line bg-canvas/85 px-4 py-3
             backdrop-blur"
    >
      <h1 class="text-lg font-bold">Oqim</h1>
    </div>

    <CityTabs
      v-if="cities.length > 1"
      :current="data?.city ?? ''"
      :cities="cities"
      :href-for="hrefFor"
    />

    <!-- The composer, at the top of the timeline where a composer goes.
         This used to be a link to the form, which is a sign pointing at a
         door rather than a door. -->
    <Composer :city="data?.city" />

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
      :to="{ path: '/qidiruv', query: city ? { shahar: city } : {} }"
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
          :to="`/kategoriya/${c.slug}${citySuffix}`"
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
