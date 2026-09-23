<script setup lang="ts">
import { parseMapLink } from '../../lib/maplink'
import { guessCategory } from '../../lib/guess'
import { submissionText } from '../../lib/submission-text'
import { compressImage, MAX_ENCODED } from '../../lib/photo'

const config = useRuntimeConfig()
const repo = config.public.repoUrl as string
const telegram = config.public.telegram as string

const { data: facets } = await useFetch('/api/facets')
const { enabled, ensure } = useAuth()
await ensure()

const form = reactive({
  name: '', top: '', sub: '', district: '', address: '', phone: '',
  hoursNote: '', website: '', comment: '', contact: '',
  website2: '', // honeypot — see the endpoint
})
const location = ref<{ lat: number; lng: number } | null>(null)

/**
 * The photo, compressed on the device.
 *
 * A phone camera produces several megabytes; what gets sent is a
 * resized JPEG well under half a megabyte. Doing that here rather than
 * server-side means the big version never leaves the phone, which on a
 * Tashkent mobile connection is the difference between a submission and
 * an abandoned one.
 */
const photo = ref<string | null>(null)
const photoBusy = ref(false)

/** The submitter's own rating. Adding a place and rating it are one act. */
const rating = ref(0)

/**
 * One status channel for the whole page.
 *
 * This form used to run four independent state machines — the link
 * lookup, the submit, the map, geolocation — each with its own message
 * in its own place, so three unrelated notices could be on screen at
 * once and none of them obviously belonged to what you had just done.
 * Everything reports here now, and only the most recent thing is shown.
 */
type Tone = 'ok' | 'info' | 'error'
const status = ref<{ tone: Tone; text: string } | null>(null)
const busy = ref(false)
const sent = ref(false)

const say = (tone: Tone, text: string) => { status.value = { tone, text } }

async function onPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoBusy.value = true
  try {
    const dataUrl = await compressImage(file)
    if (dataUrl.length > MAX_ENCODED) {
      say('error', 'Rasm juda katta — boşqa rasm tanlang.')
      return
    }
    photo.value = dataUrl
    status.value = null
  } catch {
    say('error', 'Rasmni öqib bölmadi.')
  } finally {
    photoBusy.value = false
    // Let the same file be chosen again after a removal.
    ;(event.target as HTMLInputElement).value = ''
  }
}

/** The one field: a name, or a map link that yields one. */
const primary = ref('')

/**
 * Work out what was just typed or pasted.
 *
 * A link and a name went in separate boxes before, which asked the
 * visitor to classify their own input before the form would take it.
 * They are the same question — "which place?" — so they get one box.
 */
async function readPrimary() {
  const raw = primary.value.trim()
  if (!raw) return

  if (!/^https?:\/\//i.test(raw)) {
    form.name = raw
    return
  }

  busy.value = true
  say('info', 'Havola oçilyapti…')
  let parsed = parseMapLink(raw)
  if (parsed.needsResolving) {
    // Share buttons produce short links that carry only an id; the
    // browser cannot follow them, so the server does.
    // A failure here is not worth reporting on its own: the branch
    // below already says the link yielded nothing, and the form still
    // works without it.
    parsed = await $fetch<typeof parsed>('/api/resolve-link', {
      method: 'POST', body: { url: raw },
    }).catch(() => parsed)
  }
  busy.value = false

  const got: string[] = []
  if (parsed.name) { form.name = parsed.name; primary.value = parsed.name; got.push('nomi') }
  if (parsed.coords) { location.value = parsed.coords; got.push('nuqtasi') }

  if (got.length) say('ok', `Havoladan ${got.join(' va ')} olindi.`)
  else say('error', 'Havoladan maʼlumot öqilmadi — nomini yozing.')
}

// A name usually says what the place is; making someone restate it in a
// dropdown is asking twice. Stops the moment they choose for themselves.
const categoryTouched = ref(false)
watch(() => form.name, (name) => {
  if (categoryTouched.value || !name) return
  const guess = guessCategory(name)
  if (!guess) return
  const [top, sub] = guess.split('/')
  form.top = top!
  nextTick(() => { form.sub = sub! })
})
watch(() => form.top, () => { form.sub = '' })

const ready = computed(() => form.name.trim().length >= 2 && form.top && form.sub)

function payload() {
  return {
    name: form.name,
    category: `${form.top}/${form.sub}`,
    district: form.district || undefined,
    address: form.address || undefined,
    lat: location.value?.lat,
    lng: location.value?.lng,
    phone: form.phone || undefined,
    website: form.website || undefined,
    hoursNote: form.hoursNote || undefined,
    comment: form.comment || undefined,
    contact: form.contact || undefined,
    rating: rating.value || undefined,
    photo: photo.value || undefined,
    website2: form.website2 || undefined,
  }
}

/** The message shown, copied and sent when there is no server. */
function messageText(): string {
  const cat = facets.value?.categories.find((c) => c.slug === form.top)
  const sub = cat?.children.find((ch) => ch.slug === form.sub)
  return submissionText({
    name: form.name,
    categoryLabel: sub ? `${cat!.name} — ${sub.name}` : undefined,
    districtLabel: facets.value?.districts.find((d) => d.slug === form.district)?.name,
    address: form.address,
    coords: location.value,
    rating: rating.value || undefined,
    phone: form.phone,
    hoursNote: form.hoursNote,
    website: form.website,
    comment: form.comment,
    contact: form.contact,
  })
}

async function submit() {
  if (!ready.value || busy.value) return
  status.value = null

  // No database behind the site: the same facts leave as a message.
  // Copy first — the clipboard write is only permitted inside the click.
  if (!enabled.value) {
    try {
      await navigator.clipboard.writeText(messageText())
      say('ok', telegram
        ? 'Matn nusxalandi — Telegramda joylaştiring.'
        : 'Matn nusxalandi — bizga yuboring.')
    } catch {
      say('info', 'Quyidagi matnni nusxalab yuboring.')
    }
    if (telegram) window.open(`https://t.me/${telegram}`, '_blank', 'noopener')
    return
  }

  busy.value = true
  try {
    await $fetch('/api/submissions', { method: 'POST', body: payload() })
    sent.value = true
  } catch (e: unknown) {
    say('error', (e as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Yuborib bölmadi. Qayta urinib köring.')
  } finally {
    busy.value = false
  }
}

function again() {
  Object.assign(form, {
    name: '', sub: '', address: '', phone: '', hoursNote: '',
    website: '', comment: '', website2: '',
  })
  primary.value = ''
  location.value = null
  photo.value = null
  rating.value = 0
  status.value = null
  categoryTouched.value = false
  sent.value = false
}

const TONE = {
  ok: 'text-accent',
  info: 'text-muted',
  error: 'text-accent font-medium',
} as const

useHead({
  title: 'Joy qöşiş — yalp.uz',
  meta: [{
    name: 'description',
    content: 'yalp.uz maʼlumotnomasiga yangi joy qöşiş — hisob kerak emas, bir daqiqada.',
  }],
})
</script>

<template>
  <div class="mx-auto max-w-xl">
    <h1 class="text-2xl font-bold">Joy qöşiş</h1>

    <template v-if="sent">
      <div class="mt-6 rounded-soft border border-line bg-surface p-5">
        <p class="font-medium">Rahmat! Taklifingiz qabul qilindi.</p>
        <p class="mt-2 text-sm text-muted">
          Har bir joy qölda tekşiriladi, şuning uçun bu yerdagi
          maʼlumotlarga işonsa böladi.
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            @click="again"
          >Yana bitta</button>
          <NuxtLink to="/" class="rounded-pill border border-line px-4 py-2 text-sm">
            Boş sahifa
          </NuxtLink>
        </div>
      </div>
    </template>

    <form v-else class="mt-2" @submit.prevent="submit">
      <p class="text-muted">
        Nomi, rasmi va turi — şu yetarli. Qolgani ixtiyoriy.
      </p>

      <!-- The one field. A name, or a link that yields one. -->
      <div class="mt-5">
        <label for="f-primary" class="sr-only">Joy nomi yoki xarita havolasi</label>
        <div class="flex gap-2">
          <input
            id="f-primary"
            v-model="primary"
            required
            maxlength="300"
            placeholder="Çorsu Sartaroşxonasi — yoki yandex.uz/maps/…"
            class="min-w-0 flex-1 rounded-soft border border-line bg-surface px-3 py-2.5"
            @change="readPrimary"
            @paste="nextTick(readPrimary)"
          >
          <button
            type="button"
            :disabled="busy"
            class="shrink-0 rounded-soft border border-line px-3 text-sm hover:border-accent
                   disabled:opacity-60"
            @click="readPrimary"
          >Öqiş</button>
        </div>
      </div>

      <!-- Off-screen rather than hidden, so a bot reading styles still
           finds it. Outside the block below on purpose: that block does
           not exist until a name is typed, and a bot that fills the page
           at load would never see the trap. Never shown, never tabbable. -->
      <div class="absolute left-[-9999px]" aria-hidden="true">
        <label for="f-website2">Saytingiz</label>
        <input id="f-website2" v-model="form.website2" tabindex="-1" autocomplete="off">
      </div>

      <!-- The only place anything is said. -->
      <p v-if="status" class="mt-2 text-sm" :class="TONE[status.tone]">{{ status.text }}</p>

      <!-- Everything below appears once there is something to describe. -->
      <template v-if="form.name.trim().length >= 2">
        <!-- Photo second, because it is the thing only someone standing
             there can supply, and the thing a listing is worst without. -->
        <div class="mt-5">
          <p class="text-sm text-muted mb-2">Rasm</p>
          <div v-if="photo" class="flex items-start gap-3">
            <img :src="photo" alt="Tanlangan rasm"
                 class="h-28 w-28 rounded-soft object-cover border border-line">
            <button
              type="button"
              class="rounded-pill px-3 py-1.5 text-sm text-muted hover:text-accent"
              @click="photo = null"
            >Öçiriş</button>
          </div>
          <label
            v-else
            class="flex h-28 cursor-pointer items-center justify-center rounded-soft
                   border border-dashed border-line text-sm text-muted
                   hover:border-accent hover:text-accent"
          >
            <!-- `capture` makes a phone offer the camera first, which is
                 where the useful photo actually is. -->
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="sr-only"
              @change="onPhoto"
            >
            {{ photoBusy ? 'Tayyorlanyapti…' : 'Rasm qöşiş' }}
          </label>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label for="f-top" class="block text-sm text-muted mb-1">Turi</label>
            <select
              id="f-top"
              v-model="form.top"
              required
              class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              @change="categoryTouched = true"
            >
              <option value="" disabled>Tanlang…</option>
              <option v-for="c in facets?.categories" :key="c.slug" :value="c.slug">
                {{ c.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="f-sub" class="block text-sm text-muted mb-1">Aniqroq</label>
            <select
              id="f-sub"
              v-model="form.sub"
              required
              :disabled="!form.top"
              class="w-full rounded-soft border border-line bg-surface px-3 py-2
                     disabled:opacity-50"
              @change="categoryTouched = true"
            >
              <option value="" disabled>{{ form.top ? 'Tanlang…' : '—' }}</option>
              <option
                v-for="ch in facets?.categories.find((c) => c.slug === form.top)?.children"
                :key="ch.slug"
                :value="ch.slug"
              >{{ ch.name }}</option>
            </select>
          </div>
        </div>

        <!-- Adding a place and having an opinion about it are the same
             act, so the form asks for both rather than sending someone
             back to the listing afterwards. -->
        <div class="mt-5">
          <p class="text-sm text-muted mb-2">Bahoyingiz</p>
          <StarRating
            :value="rating"
            editable
            size="lg"
            name="new-place"
            @update:value="rating = $event"
          />
        </div>

        <div class="mt-4">
          <label for="f-comment" class="block text-sm text-muted mb-1">Izohingiz</label>
          <textarea
            id="f-comment"
            v-model="form.comment"
            rows="3"
            maxlength="1000"
            placeholder="Nimasi bilan yaxşi? Boşqalarga foydali bölsin."
            class="w-full rounded-soft border border-line bg-surface px-3 py-2"
          />
        </div>

        <details class="mt-5 rounded-soft border border-line px-4 py-3">
          <summary class="cursor-pointer text-sm text-muted">
            Qayerda, telefon, iş vaqti va boşqalar
          </summary>
          <div class="mt-4 space-y-4">
            <div>
              <p class="text-sm text-muted mb-2">Qayerda?</p>
              <LocationPicker v-model="location" @status="say" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="f-district" class="block text-sm text-muted mb-1">Tuman</label>
                <select
                  id="f-district"
                  v-model="form.district"
                  class="w-full rounded-soft border border-line bg-surface px-3 py-2"
                >
                  <option value="">Bilmayman</option>
                  <option v-for="d in facets?.districts" :key="d.slug" :value="d.slug">
                    {{ d.name }}
                  </option>
                </select>
              </div>
              <div>
                <label for="f-phone" class="block text-sm text-muted mb-1">Telefon</label>
                <input
                  id="f-phone" v-model="form.phone" type="tel" inputmode="tel"
                  placeholder="90 123 45 67"
                  class="w-full rounded-soft border border-line bg-surface px-3 py-2"
                >
              </div>
            </div>
            <div>
              <label for="f-address" class="block text-sm text-muted mb-1">Manzil</label>
              <input
                id="f-address" v-model="form.address" maxlength="300"
                placeholder="Köça, uy raqami yoki maşhur joy yonida"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              >
            </div>
            <div>
              <label for="f-hours" class="block text-sm text-muted mb-1">Iş vaqti</label>
              <input
                id="f-hours" v-model="form.hoursNote" maxlength="300"
                placeholder="Har kuni 9:00–21:00, yakşanba yopiq"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              >
            </div>
            <div>
              <label for="f-website" class="block text-sm text-muted mb-1">
                Sayt, Telegram yoki Instagram
              </label>
              <input
                id="f-website" v-model="form.website" maxlength="200"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              >
            </div>
            <div>
              <label for="f-contact" class="block text-sm text-muted mb-1">
                Siz bilan qanday boğlanaylik?
              </label>
              <input
                id="f-contact" v-model="form.contact" maxlength="200"
                placeholder="Telefon yoki Telegram — savol tuğilsa"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              >
              <p class="mt-1 text-xs text-muted">Saytda körsatilmaydi.</p>
            </div>
          </div>
        </details>

        <button
          type="submit"
          :disabled="!ready || busy"
          class="mt-5 w-full rounded-pill bg-accent px-4 py-3 font-medium text-accent-ink
                 disabled:opacity-60"
        >
          {{ busy ? 'Yuborilyapti…' : enabled ? 'Yuboriş' : 'Nusxalaş va yuboriş' }}
        </button>

        <!-- Only when there is no server, and only once it would be sent. -->
        <div v-if="!enabled && ready" class="mt-3">
          <label for="f-msg" class="block text-sm text-muted mb-1">Yuboriladigan matn</label>
          <textarea
            id="f-msg" :value="messageText()" readonly rows="6"
            class="w-full rounded-soft border border-line bg-raised px-3 py-2 font-mono text-xs"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
        </div>
      </template>
    </form>

    <details class="mt-10 text-sm">
      <summary class="cursor-pointer text-muted">Boşqa yöllar</summary>
      <div class="mt-3 space-y-3 text-muted">
        <p>
          <a :href="`${repo}/issues/new?template=joy-qoshish.yml`" rel="noopener"
             class="text-accent">GitHub formasi</a>
          — hisob kerak, lekin muhokama oçiq qoladi.
        </p>
        <p><a :href="repo" rel="noopener" class="text-accent">Repozitoriya</a></p>
      </div>
    </details>
  </div>
</template>
