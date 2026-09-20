<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const { data: b } = await useFetch(`/api/business/${route.params.slug}`)

if (!b.value) throw createError({ statusCode: 404, statusMessage: 'Joy topilmadi' })

const DAY_LABELS: Record<string, string> = {
  mon: 'Dushanba', tue: 'Seşanba', wed: 'Çorşanba', thu: 'Payşanba',
  fri: 'Juma', sat: 'Şanba', sun: 'Yakşanba',
}
const SCHEMA_DAYS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}
const ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * Tashkent is UTC+5 year-round with no DST. Computing against the
 * visitor's own clock would tell a traveller the wrong answer, so pin
 * the offset.
 */
function tashkentNow() {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60_000
  return new Date(utc + 5 * 3_600_000)
}

const openNow = computed(() => {
  const hours = b.value?.hours
  if (!hours) return null
  const now = tashkentNow()
  const today = ORDER[(now.getDay() + 6) % 7]
  const entry = (hours as Record<string, unknown>)[today]
  if (!entry || entry === 'closed') return false
  const [open, close] = entry as [string, string]
  const mins = now.getHours() * 60 + now.getMinutes()
  const toMins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5)
  return mins >= toMins(open) && mins < toMins(close)
})

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: b.value!.name,
  /**
   * The SEO rescue for the new alphabet. Rendered text is new Latin, so
   * without these a search for "chorsu" never reaches this page —
   * generic diacritic folding gives ç -> c, not ç -> ch.
   */
  alternateName: [...new Set([b.value!.nameStandard, b.value!.nameAscii])]
    .filter((n) => n !== b.value!.name),
  description: b.value!.description,
  address: {
    '@type': 'PostalAddress',
    streetAddress: b.value!.address,
    addressLocality: 'Toshkent',
    addressCountry: 'UZ',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: b.value!.location.lat,
    longitude: b.value!.location.lng,
  },
  ...(b.value!.phones?.length ? { telephone: b.value!.phones[0] } : {}),
  ...(b.value!.website ? { url: b.value!.website } : {}),
  openingHoursSpecification: Object.entries(b.value!.hours ?? {})
    .filter(([, v]) => v !== 'closed')
    .map(([day, v]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SCHEMA_DAYS[day],
      opens: (v as [string, string])[0],
      closes: (v as [string, string])[1],
    })),
}))

useHead({
  title: `${b.value.name} — ${b.value.districtName}, Toşkent | yalp.uz`,
  meta: [
    {
      name: 'description',
      // Mixed on purpose: the visible page is new Latin, but the meta
      // description carries the ASCII spelling crawlers and users type.
      content: `${b.value.nameAscii} — ${b.value.categoryAscii}, ${b.value.districtAscii}, Toshkent. ${b.value.address}`,
    },
  ],
  link: [{ rel: 'canonical', href: `${config.public.siteUrl}/b/${b.value.slug}` }],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd.value) }],
})
</script>

<template>
  <article v-if="b">
    <h1 class="text-2xl font-bold">{{ b.name }}</h1>

    <!-- Visible, indexed, and genuinely useful: the spelling people know. -->
    <p v-if="b.nameAscii !== b.name" class="text-sm opacity-60 mt-1">
      Boşqa nomi: {{ b.nameAscii }}
    </p>

    <p class="text-sm opacity-75 mt-2">
      {{ b.categoryName }} · {{ b.districtName }}
      <span v-if="b.price"> · {{ '$'.repeat(b.price) }}</span>
      <span v-if="openNow !== null" class="ml-2 font-medium" :class="openNow ? 'text-teal-600' : 'text-neutral-500'">
        {{ openNow ? '· Hozir ochiq' : '· Hozir yopiq' }}
      </span>
    </p>

    <p v-if="b.description" class="mt-4 leading-relaxed">{{ b.description }}</p>

    <dl class="mt-6 space-y-2 text-sm">
      <div>
        <dt class="opacity-60">Manzil</dt>
        <dd>{{ b.address }}</dd>
      </div>
      <div v-if="b.phones?.length">
        <dt class="opacity-60">Telefon</dt>
        <dd>
          <a v-for="p in b.phones" :key="p" :href="`tel:${p.replace(/\s/g, '')}`"
             class="text-teal-600 dark:text-teal-400 mr-3">{{ p }}</a>
        </dd>
      </div>
      <div v-if="b.telegram || b.instagram || b.website">
        <dt class="opacity-60">Havolalar</dt>
        <dd class="flex gap-3">
          <a v-if="b.telegram" :href="`https://t.me/${b.telegram.slice(1)}`" rel="noopener"
             class="text-teal-600 dark:text-teal-400">Telegram</a>
          <a v-if="b.instagram" :href="`https://instagram.com/${b.instagram}`" rel="noopener"
             class="text-teal-600 dark:text-teal-400">Instagram</a>
          <a v-if="b.website" :href="b.website" rel="noopener"
             class="text-teal-600 dark:text-teal-400">Sayt</a>
        </dd>
      </div>
    </dl>

    <section v-if="b.hours" class="mt-6">
      <h2 class="font-semibold mb-2">Iş vaqti</h2>
      <table class="text-sm w-full max-w-xs">
        <tbody>
          <tr v-for="d in ORDER" :key="d">
            <td class="py-0.5 opacity-70">{{ DAY_LABELS[d] }}</td>
            <td class="py-0.5 text-right tabular-nums">
              <template v-if="!b.hours[d]">—</template>
              <template v-else-if="b.hours[d] === 'closed'">Yopiq</template>
              <template v-else>{{ b.hours[d][0] }}–{{ b.hours[d][1] }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- The map is deliberately a link, not an embed: MapLibre is ~200KB
         and this is the page that must stay fast. It becomes a real map
         in Phase 2, lazy-loaded on tap. -->
    <section class="mt-6">
      <h2 class="font-semibold mb-2">Xaritada</h2>
      <a
        :href="`https://www.openstreetmap.org/?mlat=${b.location.lat}&mlon=${b.location.lng}#map=17/${b.location.lat}/${b.location.lng}`"
        rel="noopener"
        class="text-teal-600 dark:text-teal-400 text-sm"
      >{{ b.location.lat.toFixed(5) }}, {{ b.location.lng.toFixed(5) }} — xaritada koʻriş</a>
    </section>

    <p class="mt-8 text-sm opacity-60">
      Maʼlumot notoʻğrimi?
      <a :href="`https://github.com/hadytech/todo/edit/main/data/businesses/${b.slug}.yaml`"
         rel="noopener" class="text-teal-600 dark:text-teal-400">Tuzatiş yuboring</a>
    </p>
  </article>
</template>
