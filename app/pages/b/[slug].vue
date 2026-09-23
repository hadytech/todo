<script setup lang="ts">
import { WEEKDAYS, normalizeDay, formatDay, isOpenAt, tashkentNow } from '../../../lib/hours'

const route = useRoute()
const config = useRuntimeConfig()
const asset = useAssetUrl()
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

const openNow = computed(() => isOpenAt(b.value?.hours, tashkentNow()))

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  /**
   * Stable node id. ReviewSection emits the ratings as a second block
   * carrying this same id, and search engines merge nodes by it — that
   * is what lets the reviews live with the component that fetches them
   * instead of being threaded back up into this object.
   */
  '@id': `${config.public.siteUrl}/b/${b.value!.slug}#business`,
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
  // One specification per range. A day with a break produces two, which
  // is exactly how schema.org expects it to be said.
  openingHoursSpecification: Object.entries(b.value!.hours ?? {})
    .flatMap(([day, v]) => normalizeDay(v as never).map(([opens, closes]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SCHEMA_DAYS[day],
      opens,
      closes,
    }))),
}))

const ogImage = computed(() => {
  // With photos: the JPEG variant from `npm run photos`, not the AVIF the
  // page displays — scrapers largely cannot decode AVIF.
  // Without: the generated card from `npm run og`, which at least names
  // the business rather than showing the same logo as every other link.
  const path = b.value?.photos?.length
    ? `/photos/${b.value.slug}-og.jpg`
    : `/og/${b.value!.slug}.png`
  return `${config.public.siteUrl}${path}`
})

const pageUrl = computed(() => `${config.public.siteUrl}/b/${b.value!.slug}`)

/**
 * Link previews carry a lot of weight here — most sharing happens in
 * Telegram, where the card is often all anyone sees before deciding to
 * tap. The description uses the ASCII spelling for the same reason the
 * meta description does.
 */
useSeoMeta({
  ogType: 'website',
  ogSiteName: 'yalp.uz',
  ogLocale: 'uz_UZ',
  ogTitle: () => `${b.value!.name} — ${b.value!.districtName}`,
  ogDescription: () => `${b.value!.categoryAscii}, ${b.value!.districtAscii}, Toshkent. ${b.value!.address}`,
  ogUrl: () => pageUrl.value,
  ogImage: () => ogImage.value,
  twitterCard: 'summary_large_image',
})

/**
 * Breadcrumbs are what turn a SERP entry from a bare URL into a readable
 * trail, and they tie each business page to its landing page — which is
 * where the ranking actually accrues.
 */
/**
 * The trail is rendered as well as declared. Visible breadcrumbs give the
 * visitor a way up and out, and give the district and landing pages the
 * internal links they need to rank — those pages are where search traffic
 * actually lands.
 */
const trail = computed(() => [
  { name: 'Bosh sahifa', ascii: 'yalp.uz', to: '/' },
  { name: b.value!.districtName, ascii: b.value!.districtAscii, to: `/tuman/${b.value!.district}` },
  {
    name: b.value!.categoryName,
    ascii: b.value!.categoryAscii,
    to: `/toshkent/${b.value!.district}/${b.value!.categoryTop}`,
  },
])

const breadcrumbs = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    ...trail.value.map((t) => ({ name: t.ascii, item: `${config.public.siteUrl}${t.to}` })),
    { name: b.value!.nameAscii, item: pageUrl.value },
  ].map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, item: e.item })),
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
  script: [
    { type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd.value) },
    { type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumbs.value) },
  ],
})
</script>

<template>
  <article v-if="b">
    <nav class="text-sm text-muted mb-2 flex flex-wrap gap-x-1">
      <template v-for="(t, i) in trail" :key="t.to">
        <NuxtLink :to="t.to" class="hover:opacity-100 hover:text-accent">{{ t.name }}</NuxtLink>
        <span v-if="i < trail.length - 1">›</span>
      </template>
    </nav>

    <h1 class="text-2xl font-bold">{{ b.name }}</h1>

    <!-- Visible, indexed, and genuinely useful: the spelling people know. -->
    <p v-if="b.nameAscii !== b.name" class="text-sm text-muted mt-1">
      Boşqa nomi: {{ b.nameAscii }}
    </p>

    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-sm text-muted">
      <span>{{ b.categoryName }} · {{ b.districtName }}</span>
      <span v-if="b.price">· {{ '$'.repeat(b.price) }}</span>
      <span
        v-if="openNow !== null"
        class="rounded-pill px-2 py-0.5 text-xs font-medium"
        :class="openNow
          ? 'bg-accent-soft text-accent'
          : 'bg-raised text-muted'"
      >{{ openNow ? 'Hozir oçiq' : 'Hozir yopiq' }}</span>
    </div>

    <div v-if="b.photos?.length" class="mt-4 flex gap-2 overflow-x-auto -mx-4 px-4 snap-x">
      <img
        v-for="(p, i) in b.photos"
        :key="p.file"
        :src="asset(`photos/${p.file}`)"
        :alt="p.alt"
        width="320"
        height="213"
        :loading="i === 0 ? 'eager' : 'lazy'"
        decoding="async"
        class="h-40 w-auto rounded-soft object-cover snap-start shrink-0"
      >
    </div>

    <p v-if="b.description" class="mt-4 leading-relaxed">{{ b.description }}</p>

    <dl class="mt-6 space-y-2 text-sm">
      <div>
        <dt class="text-muted">Manzil</dt>
        <dd>{{ b.address }}</dd>
      </div>
      <div v-if="b.phones?.length">
        <dt class="text-muted">Telefon</dt>
        <dd>
          <a v-for="p in b.phones" :key="p" :href="`tel:${p.replace(/\s/g, '')}`"
             class="text-accent mr-3">{{ p }}</a>
        </dd>
      </div>
      <div v-if="b.telegram || b.instagram || b.website">
        <dt class="text-muted">Havolalar</dt>
        <dd class="flex gap-3">
          <a v-if="b.telegram" :href="`https://t.me/${b.telegram.slice(1)}`" rel="noopener"
             class="text-accent">Telegram</a>
          <a v-if="b.instagram" :href="`https://instagram.com/${b.instagram}`" rel="noopener"
             class="text-accent">Instagram</a>
          <a v-if="b.website" :href="b.website" rel="noopener"
             class="text-accent">Sayt</a>
        </dd>
      </div>
    </dl>

    <section v-if="b.hours" class="mt-6">
      <h2 class="font-semibold mb-2">Iş vaqti</h2>
      <table class="text-sm w-full max-w-sm">
        <tbody>
          <tr v-for="d in WEEKDAYS" :key="d">
            <td class="py-0.5 text-muted">{{ DAY_LABELS[d] }}</td>
            <td class="py-0.5 text-right tabular-nums">{{ formatDay(b.hours[d]) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="mt-6">
      <h2 class="font-semibold mb-2">Xaritada</h2>
      <MapView :markers="[{ lat: b.location.lat, lng: b.location.lng, name: b.name }]" height="16rem" />
    </section>

    <ReviewSection :slug="b.slug" :business-name="b.name" />

    <p class="mt-8 text-sm text-muted">
      Maʼlumot notöğrimi?
      <a :href="`${config.public.repoUrl}/edit/main/data/businesses/${b.slug}.yaml`"
         rel="noopener" class="text-accent">Tuzatiş yuboring</a>
      <span class="text-muted">&nbsp;yoki&nbsp;</span>
      <a :href="`${config.public.repoUrl}/issues/new?template=tuzatish.yml`"
         rel="noopener" class="text-accent">xabar bering</a>
    </p>
  </article>
</template>
