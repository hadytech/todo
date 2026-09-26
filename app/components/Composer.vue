<script setup lang="ts">
import type { IndexedBusiness } from '../../lib/search'
import { blocker, candidateName, toPost, type Draft } from '../../lib/compose'
import { compressImage, encodedBytes, MAX_ENCODED } from '../../lib/photo'

/**
 * One box, one button — the whole of adding to this directory.
 *
 * The form at /qoshish is still there and still better when somebody has
 * the opening hours and a phone number to hand. This is for the other
 * case, which is nearly every case: you are standing outside a place, you
 * have an opinion, and you have thirty seconds. Type the sentence, tap the
 * place, tap a star, post.
 *
 * What it does not ask for: category (guessed from the name), district,
 * address, hours, phone, website, contact, your name, an account. All of
 * those are either derivable, verifiable later by whoever imports the
 * suggestion, or nobody's business.
 */
const emit = defineEmits<{ posted: [kind: 'review' | 'place', slug: string | null] }>()

const { enabled, ensure } = useAuth()
await ensure()

const { load } = useSearchIndex()

const draft = reactive<Draft>({ text: '', slug: null, newName: '', rating: 0, photo: null })
/** The chosen place's display name — the chip, once something is chosen. */
const chosen = ref<{ slug: string; name: string; district?: string } | null>(null)

const busy = ref(false)
/** `to` carries a link, so somebody can go and look at what they posted. */
const status = ref<{ tone: 'ok' | 'error'; text: string; to?: string } | null>(null)
const open = ref(false)

/* ------------------------------------------------------------- suggestions */

type Hit = IndexedBusiness & { id: string }
const hits = ref<Hit[]>([])
const searching = ref(false)

/**
 * Matched against the whole text, not a token.
 *
 * Twitter completes the word you are on because a mention is one word.
 * A place is not: "chorsu bozori" is two, and "ozod kafe yonidagi" is a
 * sentence people really type. Searching everything typed so far and
 * letting them tap the answer is both simpler and more forgiving — and
 * the index is already local, so it costs one fetch on first keystroke
 * and nothing after that.
 */
let timer: ReturnType<typeof setTimeout> | null = null

watch(() => draft.text, (text) => {
  draft.newName = candidateName(text)
  if (chosen.value) return
  if (timer) clearTimeout(timer)
  const query = text.trim()
  if (query.length < 2) { hits.value = []; return }
  // Debounced: a keystroke is not a search, and MiniSearch on every one of
  // them on a mid-range phone is a visibly janky box.
  timer = setTimeout(async () => {
    searching.value = true
    try {
      const index = await load()
      hits.value = index.search(query).slice(0, 5) as Hit[]
    } catch {
      // No index, no suggestions. The new-place path still works, which is
      // the one that must never depend on a download.
      hits.value = []
    } finally {
      searching.value = false
    }
  }, 180)
})

function choose(hit: Hit) {
  chosen.value = { slug: hit.id, name: hit.name, district: hit.district }
  draft.slug = hit.id
  hits.value = []
}

function unchoose() {
  chosen.value = null
  draft.slug = null
}

/** True once it is clear this is somewhere the directory does not have. */
const asNew = computed(() => !draft.slug && draft.newName.length >= 2)

/* -------------------------------------------------------------------- photo */

const photoBusy = ref(false)

async function pickPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoBusy.value = true
  status.value = null
  try {
    const dataUrl = await compressImage(file)
    if (encodedBytes(dataUrl) > MAX_ENCODED) {
      status.value = { tone: 'error', text: 'Rasm juda katta — boşqa rasm tanlang.' }
      return
    }
    draft.photo = dataUrl
  } catch {
    status.value = { tone: 'error', text: 'Rasmni öqib bölmadi.' }
  } finally {
    photoBusy.value = false
  }
}

/* --------------------------------------------------------------------- post */

const hint = computed(() => blocker(draft))
const ready = computed(() => toPost(draft) !== null)

async function post() {
  const payload = toPost(draft)
  if (!payload || busy.value) return
  busy.value = true
  status.value = null
  try {
    if (payload.kind === 'review') {
      await $fetch('/api/reviews', {
        method: 'POST',
        body: { slug: payload.slug, rating: payload.rating, body: payload.body },
      })
      // A link rather than a redirect: seeing your own post is the point,
      // but being thrown off the page you were reading is not.
      status.value = {
        tone: 'ok',
        text: 'Şarhingiz joylandi. Rahmat!',
        to: `/b/${payload.slug}`,
      }
    } else {
      await $fetch('/api/submissions', { method: 'POST', body: payload })
      status.value = { tone: 'ok', text: 'Rahmat! Joy tekşirişga yuborildi.' }
    }
    emit('posted', payload.kind, payload.kind === 'review' ? payload.slug : null)
    reset()
  } catch (e: unknown) {
    status.value = {
      tone: 'error',
      text: (e as { data?: { statusMessage?: string } })?.data?.statusMessage
        || 'Yuborib bölmadi. Qayta urinib köring.',
    }
  } finally {
    busy.value = false
  }
}

function reset() {
  draft.text = ''
  draft.rating = 0
  draft.photo = null
  draft.newName = ''
  unchoose()
  hits.value = []
  open.value = false
}

const boxId = useId()
</script>

<template>
  <!-- Only when there is somewhere for a post to go. With no database the
       honest thing is to point at the form, which can still hand the
       details to a person. -->
  <section v-if="enabled" class="border-b border-line px-4 py-3">
    <label :for="boxId" class="sr-only">Joy haqida yoziş</label>
    <textarea
      :id="boxId"
      v-model="draft.text"
      rows="2"
      maxlength="4000"
      placeholder="Qayerda bölding? Nimasi yaxşi edi?"
      class="w-full resize-none bg-transparent text-lg placeholder:text-muted
             focus:outline-none"
      @focus="open = true"
    />

    <!-- Matching places, as a list you tap. The directory's own index,
         loaded on the first keystroke and never on page load. -->
    <ul v-if="hits.length && !chosen" class="mb-2 rounded-soft border border-line overflow-hidden">
      <li v-for="h in hits" :key="h.id">
        <button
          type="button"
          class="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-raised"
          @click="choose(h)"
        >
          <span class="font-medium">{{ h.name }}</span>
          <span class="text-xs text-muted">{{ h.address || h.district }}</span>
        </button>
      </li>
    </ul>

    <!-- What this post is about: a chip for a chosen place, or the name
         proposed from what was typed, editable in place. -->
    <div v-if="chosen" class="mb-2 flex items-center gap-2 text-sm">
      <span class="rounded-pill bg-accent-soft px-3 py-1 text-accent">{{ chosen.name }}</span>
      <button type="button" class="text-muted hover:text-accent" @click="unchoose">
        boşqa joy
      </button>
    </div>

    <div v-else-if="asNew" class="mb-2">
      <label :for="`${boxId}-name`" class="block text-xs text-muted mb-1">
        Yangi joy nomi — töğrilaş mumkin
      </label>
      <input
        :id="`${boxId}-name`"
        v-model="draft.newName"
        maxlength="120"
        class="w-full rounded-soft border border-line bg-canvas px-3 py-1.5 text-sm"
      >
    </div>

    <img
      v-if="draft.photo"
      :src="draft.photo"
      alt=""
      class="mb-2 max-h-48 w-full rounded-soft object-cover"
    >

    <!-- The action row. Everything on one line, the way a composer is. -->
    <div v-if="open || draft.text" class="flex flex-wrap items-center gap-3">
      <StarRating
        :value="draft.rating"
        editable
        size="lg"
        name="compose"
        @update:value="draft.rating = $event"
      />

      <label
        class="cursor-pointer rounded-pill border border-line px-3 py-1.5 text-sm
               hover:border-accent"
      >
        <input type="file" accept="image/*" class="sr-only" @change="pickPhoto">
        {{ photoBusy ? 'Tayyorlanyapti…' : draft.photo ? 'Rasm almaştiriş' : 'Rasm' }}
      </label>

      <span v-if="hint" class="text-xs text-muted">{{ hint }}</span>

      <button
        type="button"
        :disabled="!ready || busy"
        class="ml-auto rounded-pill bg-accent px-5 py-2 font-medium text-accent-ink
               disabled:opacity-50"
        @click="post"
      >{{ busy ? 'Joylanyapti…' : 'Joylaş' }}</button>
    </div>

    <p
      v-if="status"
      class="mt-2 text-sm"
      :class="status.tone === 'error' ? 'text-accent font-medium' : 'text-accent'"
      role="status"
    >
      {{ status.text }}
      <NuxtLink v-if="status.to" :to="status.to" class="underline">Körish</NuxtLink>
    </p>

    <p v-if="open" class="mt-2 text-xs text-muted">
      Hisob kerak emas. Manzilingiz saqlanmaydi.
      <NuxtLink to="/maxfiylik" class="underline hover:text-accent">Maxfiylik</NuxtLink>
      ·
      <NuxtLink to="/qoshish" class="underline hover:text-accent">Batafsil forma</NuxtLink>
    </p>
  </section>

  <!-- No database behind the site: the form can still hand the details to
       a person, and says so. -->
  <section v-else class="border-b border-line px-4 py-3 text-sm text-muted">
    <NuxtLink to="/qoshish" class="text-accent underline">Joy qöşiş</NuxtLink>
    — hisob kerak emas.
  </section>
</template>
