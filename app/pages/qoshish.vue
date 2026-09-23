<script setup lang="ts">
import { parseMapLink } from '../../lib/maplink'
import { guessCategory } from '../../lib/guess'
import { submissionText } from '../../lib/submission-text'

const config = useRuntimeConfig()
const repo = config.public.repoUrl as string

const { data: facets } = await useFetch('/api/facets')
const { enabled, ensure } = useAuth()
await ensure()

const form = reactive({
  name: '',
  top: '',
  sub: '',
  district: '',
  address: '',
  phone: '',
  hoursNote: '',
  website: '',
  comment: '',
  contact: '',
  website2: '', // honeypot — see the endpoint
})

const location = ref<{ lat: number; lng: number } | null>(null)
const state = ref<'editing' | 'sending' | 'sent' | 'failed'>('editing')
const error = ref('')

/**
 * The fast path: one pasted link fills the name and the pin.
 *
 * This is first on the page because it is what most people can actually
 * produce — the place is already open in Yandex Maps and the share
 * button is one tap. A short link (which is what that button gives you)
 * carries nothing but an id, so the server follows it; a long one is
 * read here without a round trip.
 */
const link = reactive({ url: '', state: 'idle' as 'idle' | 'working' | 'done' | 'failed', filled: [] as string[] })

async function useLink() {
  const raw = link.url.trim()
  if (!raw) return
  link.state = 'working'
  link.filled = []

  let parsed = parseMapLink(raw)
  if (parsed.needsResolving) {
    try {
      const r = await $fetch<{ ok: boolean; url: string; coords: typeof location.value; name: string | null }>(
        '/api/resolve-link', { method: 'POST', body: { url: raw } })
      if (r.ok) parsed = { coords: r.coords, name: r.name, address: null, needsResolving: false }
    } catch {
      // Falls through to the "could not read it" branch below. The form
      // still works; only this shortcut failed.
    }
  }

  // Never overwrite something the person already typed — a link is a
  // suggestion, and they know the name of the shop better than a URL slug.
  if (parsed.name && !form.name.trim()) {
    form.name = parsed.name
    link.filled.push('nomi')
  }
  if (parsed.coords) {
    location.value = parsed.coords
    link.filled.push('nuqtasi')
  }
  link.state = link.filled.length ? 'done' : 'failed'
}

/**
 * Preselect a category from the name, and only while the person has not
 * chosen one themselves. A guess that overrides a real choice is worse
 * than no guess at all.
 */
const categoryTouched = ref(false)
watch(() => form.name, (name) => {
  if (categoryTouched.value || !name) return
  const guess = guessCategory(name)
  if (!guess) return
  const [top, sub] = guess.split('/')
  form.top = top!
  nextTick(() => { form.sub = sub! })
})

const subcategories = computed(() =>
  facets.value?.categories.find((c) => c.slug === form.top)?.children ?? [])

// Changing the top category invalidates whatever was picked under it.
watch(() => form.top, () => { form.sub = '' })

/** The two things a suggestion cannot be filed without. */
const ready = computed(() => form.name.trim().length >= 2 && form.top && form.sub)

/**
 * What the form does when there is no server to post to.
 *
 * A static build has no /api/submissions, and the old page answered that
 * by hiding the form and pointing at GitHub — which is precisely the
 * barrier the form exists to remove. So the form stays, and the same
 * facts leave as a message the person sends over Telegram.
 *
 * Copy first, open second: the clipboard write has to happen inside the
 * click to be allowed at all, and Telegram cannot be handed prefilled
 * text for a specific chat.
 */
const copied = ref(false)

function messageText(): string {
  const cat = facets.value?.categories.find((c) => c.slug === form.top)
  const sub = cat?.children.find((ch) => ch.slug === form.sub)
  return submissionText({
    name: form.name,
    categoryLabel: sub ? `${cat!.name} — ${sub.name}` : undefined,
    districtLabel: facets.value?.districts.find((d) => d.slug === form.district)?.name,
    address: form.address,
    coords: location.value,
    phone: form.phone,
    hoursNote: form.hoursNote,
    website: form.website,
    comment: form.comment,
    contact: form.contact,
  })
}

async function sendOffline() {
  if (!ready.value) return
  const text = messageText()
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
  } catch {
    // Clipboard can be refused outright — an insecure origin, a locked
    // down browser. The textarea below still shows the message, so the
    // person can select it by hand.
    copied.value = false
  }
  const to = config.public.telegram as string
  if (to) window.open(`https://t.me/${to}`, '_blank', 'noopener')
}

async function submit() {
  if (!ready.value) return
  if (!enabled.value) return sendOffline()
  error.value = ''
  state.value = 'sending'
  try {
    await $fetch('/api/submissions', {
      method: 'POST',
      body: {
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
        website2: form.website2 || undefined,
      },
    })
    state.value = 'sent'
  } catch (e: unknown) {
    state.value = 'failed'
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Yuborib boʻlmadi. Qayta urinib koʻring.'
  }
}

function again() {
  Object.assign(form, {
    name: '', sub: '', address: '', phone: '', hoursNote: '',
    website: '', comment: '', website2: '',
  })
  location.value = null
  copied.value = false
  link.url = ''
  link.state = 'idle'
  link.filled = []
  categoryTouched.value = false
  state.value = 'editing'
}

useHead({
  title: 'Joy qoʻşiş — yalp.uz',
  meta: [{
    name: 'description',
    content: 'yalp.uz maʼlumotnomasiga yangi joy qoʻşiş — hisob kerak emas, bir daqiqada.',
  }],
})
</script>

<template>
  <div class="mx-auto max-w-xl">
    <h1 class="text-2xl font-bold">Joy qoʻşiş</h1>

    <!-- Sent ------------------------------------------------------- -->
    <template v-if="state === 'sent'">
      <div class="mt-6 rounded-soft border border-line bg-surface p-5">
        <p class="font-medium">Rahmat! Taklifingiz qabul qilindi.</p>
        <p class="mt-2 text-sm text-muted">
          Biz maʼlumotni tekşirib, saytga qoʻşamiz. Bu bir neça kun olişi
          mumkin — har bir joy qoʻlda tekşiriladi, şuning uçun bu yerdagi
          maʼlumotlarga işonsa boʻladi.
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            @click="again"
          >Yana bitta qoʻşiş</button>
          <NuxtLink to="/" class="rounded-pill border border-line px-4 py-2 text-sm">
            Bosh sahifa
          </NuxtLink>
        </div>
      </div>
    </template>

    <!-- Form ------------------------------------------------------- -->
    <template v-else>
      <p class="mt-2 text-muted">
        Hisob ham, texnik bilim ham kerak emas. Faqat nomi va turini
        yozing — qolganini bilsangiz qoʻşing, bilmasangiz boʻş qoldiring.
        <span v-if="!enabled" class="block mt-1">
          {{ config.public.telegram
            ? 'Hozir taklif Telegram orqali yuboriladi.'
            : 'Hozir taklif matn koʻrinişida nusxalanadi.' }}
        </span>
      </p>

      <form class="mt-6 space-y-5" @submit.prevent="submit">
        <!-- The fast path, first: most people have the place open in a
             maps app and can share it in one tap. -->
        <div class="rounded-soft border border-accent/40 bg-accent-soft/40 p-4">
          <label for="f-link" class="block text-sm font-medium mb-1">
            Tez yoʻl — xarita havolasini joylaştiring
          </label>
          <p class="mb-2 text-xs text-muted">
            Yandex, Google yoki 2GIS. Nomi va nuqtasi oʻzi toʻladi.
          </p>
          <div class="flex gap-2">
            <input
              id="f-link"
              v-model="link.url"
              type="url"
              inputmode="url"
              placeholder="https://yandex.uz/maps/..."
              class="min-w-0 flex-1 rounded-soft border border-line bg-surface px-3 py-2"
              @paste="nextTick(useLink)"
              @keydown.enter.prevent="useLink"
            >
            <button
              type="button"
              :disabled="link.state === 'working'"
              class="shrink-0 rounded-soft bg-accent px-4 py-2 text-sm font-medium
                     text-accent-ink disabled:opacity-60"
              @click="useLink"
            >{{ link.state === 'working' ? '…' : 'Toʻldiriş' }}</button>
          </div>
          <p v-if="link.state === 'done'" class="mt-2 text-sm text-accent">
            Havoladan {{ link.filled.join(' va ') }} olindi.
          </p>
          <p v-else-if="link.state === 'failed'" class="mt-2 text-sm text-muted">
            Havoladan maʼlumot oʻqilmadi — quyida qoʻlda toʻldiring.
          </p>
        </div>

        <div>
          <label for="f-name" class="block text-sm font-medium mb-1">
            Joy nomi <span class="text-accent">*</span>
          </label>
          <input
            id="f-name"
            v-model="form.name"
            required
            maxlength="120"
            placeholder="Masalan: Çorsu Sartaroşxonasi"
            class="w-full rounded-soft border border-line bg-surface px-3 py-2"
          >
          <p class="mt-1 text-xs text-muted">
            Yangi alifboda yozsangiz yaxşi (ö ğ ç ş), lekin odatdagiça
            yozsangiz ham boʻladi — biz tuzatamiz.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="f-top" class="block text-sm font-medium mb-1">
              Turi <span class="text-accent">*</span>
            </label>
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
            <label for="f-sub" class="block text-sm font-medium mb-1">
              Aniqroq <span class="text-accent">*</span>
            </label>
            <select
              id="f-sub"
              v-model="form.sub"
              required
              :disabled="!form.top"
              @change="categoryTouched = true"
              class="w-full rounded-soft border border-line bg-surface px-3 py-2
                     disabled:opacity-50"
            >
              <option value="" disabled>{{ form.top ? 'Tanlang…' : 'Avval turini tanlang' }}</option>
              <option v-for="ch in subcategories" :key="ch.slug" :value="ch.slug">
                {{ ch.name }}
              </option>
            </select>
          </div>
        </div>

        <fieldset class="rounded-soft border border-line p-4">
          <legend class="px-1 text-sm font-medium">Qayerda?</legend>
          <LocationPicker v-model="location" />
        </fieldset>

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
              id="f-phone"
              v-model="form.phone"
              type="tel"
              inputmode="tel"
              placeholder="90 123 45 67"
              class="w-full rounded-soft border border-line bg-surface px-3 py-2"
            >
          </div>
        </div>

        <div>
          <label for="f-address" class="block text-sm text-muted mb-1">Manzil</label>
          <input
            id="f-address"
            v-model="form.address"
            maxlength="300"
            placeholder="Koʻça, uy raqami yoki mashur joy yonida"
            class="w-full rounded-soft border border-line bg-surface px-3 py-2"
          >
        </div>

        <div>
          <label for="f-hours" class="block text-sm text-muted mb-1">Iş vaqti</label>
          <!-- Free text on purpose. A seven-row schedule widget is where
               a form like this loses people. -->
          <input
            id="f-hours"
            v-model="form.hoursNote"
            maxlength="300"
            placeholder="Masalan: har kuni 9:00–21:00, yakşanba yopiq"
            class="w-full rounded-soft border border-line bg-surface px-3 py-2"
          >
        </div>

        <details class="rounded-soft border border-line px-4 py-3">
          <summary class="cursor-pointer text-sm font-medium">
            Qoʻşimça (ixtiyoriy)
          </summary>
          <div class="mt-4 space-y-4">
            <div>
              <label for="f-website" class="block text-sm text-muted mb-1">
                Sayt, Telegram yoki Instagram
              </label>
              <input
                id="f-website"
                v-model="form.website"
                maxlength="200"
                placeholder="instagram.com/… yoki @kanal"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              >
            </div>
            <div>
              <label for="f-comment" class="block text-sm text-muted mb-1">
                Yana nima bilasiz?
              </label>
              <textarea
                id="f-comment"
                v-model="form.comment"
                rows="3"
                maxlength="1000"
                placeholder="Nimasi bilan yaxşi, qaysi qavatda, qanday topiladi…"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              />
            </div>
            <div>
              <label for="f-contact" class="block text-sm text-muted mb-1">
                Siz bilan qanday boğlanaylik?
              </label>
              <input
                id="f-contact"
                v-model="form.contact"
                maxlength="200"
                placeholder="Telefon yoki Telegram — savol tuğilsa"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              >
              <p class="mt-1 text-xs text-muted">
                Saytda hech qaçon koʻrsatilmaydi.
              </p>
            </div>
          </div>
        </details>

        <!-- Honeypot: off-screen, not hidden, so a bot reading styles
             still finds it. Never shown to a person, never tabbable. -->
        <div class="absolute left-[-9999px]" aria-hidden="true">
          <label for="f-website2">Saytingiz</label>
          <input id="f-website2" v-model="form.website2" tabindex="-1" autocomplete="off">
        </div>

        <p v-if="error" class="text-sm text-accent">{{ error }}</p>

        <button
          type="submit"
          :disabled="!ready || state === 'sending'"
          class="w-full rounded-pill bg-accent px-4 py-3 font-medium text-accent-ink
                 disabled:opacity-60"
        >
          <!-- Three honest labels, because the button does three
               different things depending on what is configured. -->
          {{ state === 'sending'
            ? 'Yuborilyapti…'
            : enabled
              ? 'Yuboriş'
              : config.public.telegram
                ? 'Nusxalaş va Telegramda yuboriş'
                : 'Matnni nusxalaş' }}
        </button>

        <!-- No server: the same facts, as a message to send by hand. -->
        <template v-if="!enabled && ready">
          <p v-if="copied" class="text-sm text-accent">
            {{ config.public.telegram
              ? 'Matn nusxalandi — Telegramda joylaştiring (uzun bosib "Paste").'
              : 'Matn nusxalandi — bizga yuboring.' }}
          </p>
          <div>
            <label for="f-msg" class="block text-sm text-muted mb-1">
              Yuboriladigan matn
            </label>
            <textarea
              id="f-msg"
              :value="messageText()"
              readonly
              rows="7"
              class="w-full rounded-soft border border-line bg-raised px-3 py-2
                     font-mono text-xs"
              @focus="($event.target as HTMLTextAreaElement).select()"
            />
          </div>
        </template>

        <p class="text-xs text-muted">
          Har bir taklif qoʻlda tekşiriladi. Nomi va turi yetarli —
          qolganini biz topamiz.
        </p>
      </form>
    </template>

    <!-- The old routes stay, further down. Some people genuinely prefer
         them, and the repository is the source of truth either way. -->
    <details class="mt-10 text-sm">
      <summary class="cursor-pointer text-muted">Boşqa yoʻllar</summary>
      <div class="mt-3 space-y-3 text-muted">
        <p>
          <a :href="`${repo}/issues/new?template=joy-qoshish.yml`" rel="noopener"
             class="text-accent">GitHub formasi</a>
          — hisob kerak, lekin muhokama oçiq qoladi.
        </p>
        <p>
          Har bir joy — bitta YAML fayl. Pull request yuborsangiz, tekşiruv
          avtomatik işlaydi:
        </p>
        <pre class="overflow-x-auto rounded-soft bg-raised p-3 text-xs"><code>name: Çorsu Restorani
category: ovqatlanish/restoran
district: shayxontohur
address: Çorsu bozori yonida, Toşkent
location: { lat: 41.3264, lng: 69.2347 }
status: published</code></pre>
        <p><a :href="repo" rel="noopener" class="text-accent">Repozitoriya</a></p>
      </div>
    </details>
  </div>
</template>
