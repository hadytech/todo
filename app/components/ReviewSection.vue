<script setup lang="ts">
import { MIN_REVIEWS_FOR_AVERAGE } from '../../lib/rating'

const props = defineProps<{ slug: string; businessName: string }>()

const { user, enabled, refresh } = useAuth()

/**
 * Fetched on the server so the review text is in the HTML.
 *
 * That matters more here than anywhere else on the site: reviews are the
 * content people search for, and content that only exists after
 * hydration is content a crawler may never see. Under the Vercel preset
 * these pages are ISR, so the cost is one query per page per revalidation
 * window, not one per visit. Under the static preset there is no database
 * at build time and the section correctly renders as unavailable.
 */
const { data, pending, refresh: reload } = await useFetch(`/api/reviews/${props.slug}`, {
  lazy: true,
  default: () => ({ enabled: false, reviews: [], histogram: [0, 0, 0, 0, 0], average: null, count: 0 }),
})

onMounted(refresh)

const mine = computed(() => data.value.reviews.find((r) => r.mine) ?? null)

const form = reactive({ rating: 0, body: '', open: false, busy: false, error: '' })

function startEdit() {
  form.rating = mine.value?.rating ?? 0
  form.body = mine.value?.body ?? ''
  form.open = true
  form.error = ''
}

const remaining = computed(() => 20 - form.body.trim().length)

async function submit() {
  form.error = ''
  if (form.rating < 1) { form.error = 'Avval yulduz tanlang'; return }
  form.busy = true
  try {
    await $fetch('/api/reviews', {
      method: 'POST',
      body: { slug: props.slug, rating: form.rating, body: form.body },
    })
    form.open = false
    await reload()
  } catch (e: unknown) {
    form.error = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Saqlanmadi. Qayta urinib köring.'
  } finally {
    form.busy = false
  }
}

async function remove() {
  if (!confirm('Sharhingiz öçirilsinmi?')) return
  await $fetch('/api/reviews', { method: 'DELETE', query: { slug: props.slug } }).catch(() => {})
  await reload()
}

/**
 * Votes update the row in place before the request lands.
 *
 * A vote that waits for a round trip feels broken on a Tashkent mobile
 * connection. On failure the previous numbers are put back — an optimistic
 * update that never reconciles is just a lie that renders fast.
 */
async function vote(review: (typeof data.value.reviews)[number], value: number) {
  if (!user.value) return navigateTo('/kirish')
  const next = review.myVote === value ? 0 : value
  const before = { up: review.up, down: review.down, myVote: review.myVote }

  if (before.myVote === 1) review.up -= 1
  if (before.myVote === -1) review.down -= 1
  if (next === 1) review.up += 1
  if (next === -1) review.down += 1
  review.myVote = next

  try {
    await $fetch('/api/reviews/vote', { method: 'POST', body: { reviewId: review.id, value: next } })
  } catch {
    Object.assign(review, before)
  }
}

const fmt = new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })
const when = (iso: string) => fmt.format(new Date(iso))

/** Bar width per star row, relative to the most common rating. */
const peak = computed(() => Math.max(1, ...data.value.histogram))

/**
 * Star ratings in search results.
 *
 * Emitted as its own node carrying the business's @id, which search
 * engines merge with the LocalBusiness block the page itself emits. The
 * alternative — passing reviews up to the page so one object could hold
 * everything — would mean the page fetching data only this component
 * uses.
 *
 * Nothing is emitted below the display threshold. Google rejects an
 * aggregateRating built on one review, and rightly: it is not an
 * aggregate.
 */
const config = useRuntimeConfig()

useHead(() => {
  if (data.value.average === null) return {}
  return {
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        '@id': `${config.public.siteUrl}/b/${props.slug}#business`,
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: data.value.average,
          reviewCount: data.value.count,
          bestRating: 5,
          worstRating: 1,
        },
        // A sample, not the whole table. These exist to show search
        // engines the reviews are real; the page is where they are read.
        review: data.value.reviews.slice(0, 10).map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.authorName },
          datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
          reviewBody: r.body,
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.rating,
            bestRating: 5,
            worstRating: 1,
          },
        })),
      }),
    }],
  }
})
</script>

<template>
  <section class="mt-8">
    <h2 class="font-semibold text-lg">Sharhlar</h2>

    <!-- No database behind the site: say so once, plainly, and offer
         nothing that cannot work. -->
    <p v-if="data.enabled === false && !pending" class="mt-2 text-sm text-muted">
      Sharhlar hozirça oçiq emas.
    </p>

    <template v-else>
      <!-- Headline -->
      <div v-if="data.count" class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div class="flex items-baseline gap-2">
          <span v-if="data.average !== null" class="text-3xl font-bold tabular-nums">
            {{ data.average.toFixed(1) }}
          </span>
          <div>
            <StarRating :value="data.average" size="sm" />
            <div class="text-sm text-muted">{{ data.count }} ta sharh</div>
          </div>
        </div>

        <!-- Distribution. Five reviews averaging 3 and five split between
             1 and 5 are very different places, and the mean hides that. -->
        <div v-if="data.count >= MIN_REVIEWS_FOR_AVERAGE" class="min-w-[9rem] flex-1 max-w-xs">
          <div v-for="n in [5, 4, 3, 2, 1]" :key="n" class="flex items-center gap-2 text-xs">
            <span class="w-3 text-right tabular-nums text-muted">{{ n }}</span>
            <span class="h-1.5 flex-1 rounded-pill bg-raised overflow-hidden">
              <span
                class="block h-full rounded-pill bg-accent"
                :style="{ width: `${(data.histogram[n - 1] ?? 0) / peak * 100}%` }"
              />
            </span>
            <span class="w-4 tabular-nums text-muted">{{ data.histogram[n - 1] }}</span>
          </div>
        </div>
      </div>

      <p v-if="data.count && data.average === null" class="mt-2 text-sm text-muted">
        Örtaça baho {{ MIN_REVIEWS_FOR_AVERAGE }} ta sharhdan keyin körsatiladi.
      </p>

      <!-- Write / edit -->
      <div class="mt-5">
        <div v-if="!user && enabled" class="rounded-soft border border-line bg-surface p-4">
          <p class="text-sm">{{ businessName }} haqida fikringiz bormi?</p>
          <NuxtLink
            to="/kirish"
            class="mt-2 inline-block rounded-pill bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >Kiriş va sharh yoziş</NuxtLink>
        </div>

        <button
          v-else-if="user && !form.open"
          class="rounded-pill border border-line px-4 py-2 text-sm hover:border-accent"
          @click="startEdit"
        >{{ mine ? 'Sharhimni tahrirlaş' : 'Sharh yoziş' }}</button>

        <form
          v-else-if="user"
          class="rounded-soft border border-line bg-surface p-4 space-y-3"
          @submit.prevent="submit"
        >
          <div class="flex items-center gap-3">
            <span class="text-sm text-muted">Bahoyingiz</span>
            <StarRating
              :value="form.rating"
              editable
              size="lg"
              :name="`r-${slug}`"
              @update:value="form.rating = $event"
            />
          </div>

          <div>
            <label :for="`body-${slug}`" class="sr-only">Sharh matni</label>
            <textarea
              :id="`body-${slug}`"
              v-model="form.body"
              rows="4"
              maxlength="4000"
              placeholder="Nima yaxşi edi, nima yöq? Boşqalarga foydali bölsin."
              class="w-full rounded-soft border border-line bg-canvas px-3 py-2"
            />
            <p class="mt-1 text-xs text-muted">
              {{ remaining > 0 ? `Yana ${remaining} ta belgi` : `${form.body.trim().length} / 4000` }}
            </p>
          </div>

          <p v-if="form.error" class="text-sm text-accent">{{ form.error }}</p>

          <div class="flex flex-wrap gap-2">
            <button
              type="submit"
              :disabled="form.busy || remaining > 0"
              class="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-accent-ink
                     disabled:opacity-60"
            >{{ form.busy ? 'Saqlanyapti…' : 'Yuboriş' }}</button>
            <button
              type="button"
              class="rounded-pill border border-line px-4 py-2 text-sm"
              @click="form.open = false"
            >Bekor qiliş</button>
            <button
              v-if="mine"
              type="button"
              class="rounded-pill px-4 py-2 text-sm text-muted hover:text-accent ml-auto"
              @click="remove"
            >Öçiriş</button>
          </div>
        </form>
      </div>

      <!-- The reviews themselves -->
      <p v-if="pending" class="mt-6 text-sm text-muted">Yuklanyapti…</p>

      <ol v-else-if="data.reviews.length" class="mt-6 space-y-5">
        <li
          v-for="r in data.reviews"
          :key="r.id"
          class="border-t border-line pt-5 first:border-0 first:pt-0"
        >
          <div class="flex items-center gap-2">
            <StarRating :value="r.rating" size="sm" />
            <span class="text-sm font-medium">{{ r.authorName }}</span>
            <span v-if="r.mine" class="rounded-pill bg-accent-soft px-2 py-0.5 text-xs text-accent">
              siz
            </span>
          </div>

          <p class="mt-1 text-xs text-muted">
            {{ when(r.createdAt) }}
            <span v-if="r.editedAt">· tahrirlangan</span>
          </p>

          <p class="mt-2 leading-relaxed whitespace-pre-line">{{ r.body }}</p>

          <!-- Votes. Disabled on your own review rather than hidden, so
               the count stays visible to its author. -->
          <div class="mt-3 flex items-center gap-1 text-sm">
            <button
              class="flex items-center gap-1 rounded-pill px-2.5 py-1 hover:bg-raised
                     disabled:opacity-40 disabled:hover:bg-transparent"
              :class="r.myVote === 1 ? 'text-accent font-medium' : 'text-muted'"
              :disabled="r.mine"
              :aria-pressed="r.myVote === 1"
              :aria-label="`Foydali — ${r.up} ta ovoz`"
              @click="vote(r, 1)"
            >
              <span aria-hidden="true">▲</span>
              <span class="tabular-nums">{{ r.up }}</span>
            </button>
            <button
              class="flex items-center gap-1 rounded-pill px-2.5 py-1 hover:bg-raised
                     disabled:opacity-40 disabled:hover:bg-transparent"
              :class="r.myVote === -1 ? 'text-accent font-medium' : 'text-muted'"
              :disabled="r.mine"
              :aria-pressed="r.myVote === -1"
              :aria-label="`Foydali emas — ${r.down} ta ovoz`"
              @click="vote(r, -1)"
            >
              <span aria-hidden="true">▼</span>
              <span class="tabular-nums">{{ r.down }}</span>
            </button>
          </div>
        </li>
      </ol>

      <p v-else-if="!pending" class="mt-6 text-sm text-muted">
        Hali sharh yöq. Birinçi böling.
      </p>
    </template>
  </section>
</template>
