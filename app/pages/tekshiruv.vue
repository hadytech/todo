<script setup lang="ts">
/**
 * The suggestions queue, workable from a phone.
 *
 * Before this, approving a place meant running `npm run submissions` on a
 * laptop with the connection string to hand. That is the right tool for
 * moving a listing into git, and the wrong one for the question "is this
 * a real café" — which is answered in ten seconds, usually while standing
 * somewhere, and which was therefore never answered at all.
 *
 * Signing in is a token, not an account: see server/utils/admin.ts for
 * why, and why an absent ADMIN_TOKEN means the page is shut rather than
 * open.
 */
const token = ref('')
const signingIn = ref(false)
const error = ref('')

const { data, refresh } = await useFetch('/api/admin/queue')

async function signIn() {
  error.value = ''
  signingIn.value = true
  try {
    await $fetch('/api/admin/session', { method: 'POST', body: { token: token.value } })
    token.value = ''
    await refresh()
  } catch (e: unknown) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Kiritib bölmadi.'
  } finally {
    signingIn.value = false
  }
}

async function signOut() {
  await $fetch('/api/admin/session', { method: 'POST', body: {} }).catch(() => {})
  await refresh()
}

/** Per-row edits: the category and district a reviewer fixes before approving. */
const edits = reactive<Record<string, { category: string; city: string; district: string }>>({})
const busy = ref('')

function editsFor(row: { id: string; category: string | null; city: string; district: string | null }) {
  edits[row.id] ??= {
    category: row.category ?? '',
    city: row.city,
    district: row.district ?? '',
  }
  return edits[row.id]!
}

const cityOf = (id: string) => data.value?.cities?.find((c) => c.slug === edits[id]?.city)

async function decide(id: string, action: 'publish' | 'reject') {
  if (busy.value) return
  busy.value = id
  error.value = ''
  const e = edits[id]
  try {
    const res = await $fetch<{ slug?: string }>('/api/admin/decide', {
      method: 'POST',
      body: {
        id,
        action,
        ...(action === 'publish' && e
          ? {
              category: e.category || undefined,
              city: e.city || undefined,
              district: e.district || undefined,
            }
          : {}),
      },
    })
    if (action === 'publish' && res.slug) lastPublished.value = res.slug
    await refresh()
  } catch (err: unknown) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Bajarilmadi.'
  } finally {
    busy.value = ''
  }
}

const lastPublished = ref('')

const fmt = new Intl.DateTimeFormat('uz-UZ', {
  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
})

useHead({
  title: 'Tekşiruv | yalp.uz',
  // Never a page for a crawler, whatever the token situation.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-4">
    <h1 class="text-2xl font-bold">Tekşiruv</h1>

    <p v-if="data && !data.configured" class="mt-4 rounded-soft border border-line p-4 text-sm text-muted">
      Bu sahifa yopiq. Açiş uçun Vercel'da <code class="rounded bg-raised px-1">ADMIN_TOKEN</code>
      özgaruvçisini qöying — uzun, tasodifiy satr — va qayta joylang.
    </p>

    <!-- Signing in -->
    <form v-else-if="data && !data.admin" class="mt-5 space-y-3" @submit.prevent="signIn">
      <label for="admin-token" class="block text-sm text-muted">Kalit</label>
      <!-- Every assist turned off. A phone keyboard that capitalises the
           first letter, corrects a word or inserts a smart quote turns a
           correct key into a wrong one, and the person sees only that it
           was refused. -->
      <input
        id="admin-token"
        v-model.trim="token"
        type="password"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        class="w-full rounded-soft border border-line bg-surface px-3 py-2.5
               font-mono text-sm"
      >
      <p v-if="error" class="text-sm text-accent font-medium">{{ error }}</p>
      <button
        type="submit"
        :disabled="signingIn || !token"
        class="rounded-pill bg-accent px-5 py-2.5 font-medium text-accent-ink disabled:opacity-50"
      >{{ signingIn ? 'Tekşirilyapti…' : 'Kiriş' }}</button>
    </form>

    <template v-else-if="data?.admin">
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span><strong class="text-ink tabular-nums">{{ data.counts.pending }}</strong> kutyapti</span>
        <span><strong class="text-ink tabular-nums">{{ data.counts.published }}</strong> eʼlon qilindi</span>
        <span><strong class="text-ink tabular-nums">{{ data.counts.rejected }}</strong> rad etildi</span>
        <button class="ml-auto hover:text-accent" @click="signOut">Çiqiş</button>
      </div>

      <p v-if="error" class="mt-4 text-sm text-accent font-medium">{{ error }}</p>

      <p v-if="lastPublished" class="mt-4 rounded-soft bg-accent-soft/40 px-3 py-2 text-sm">
        Eʼlon qilindi —
        <NuxtLink :to="`/b/${lastPublished}`" class="text-accent underline">köriş</NuxtLink>
      </p>

      <p v-if="!data.rows.length" class="mt-6 text-muted">Navbat boş. Hammasi körib çiqilgan.</p>

      <ol v-else class="mt-6 space-y-6">
        <li v-for="r in data.rows" :key="r.id" class="rounded-soft border border-line p-4">
          <div class="flex items-baseline gap-2">
            <h2 class="font-semibold text-lg">{{ r.name }}</h2>
            <span class="text-xs text-muted">{{ fmt.format(new Date(r.createdAt)) }}</span>
          </div>

          <div v-if="r.rating" class="mt-1">
            <StarRating :value="r.rating" size="sm" />
          </div>

          <p v-if="r.comment" class="mt-2 text-sm leading-relaxed whitespace-pre-line">
            {{ r.comment }}
          </p>

          <img
            v-if="r.photo"
            :src="r.photo"
            alt=""
            class="mt-3 max-h-64 w-full rounded-soft object-cover"
          >

          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-muted">
            <template v-if="r.address"><dt>Manzil</dt><dd>{{ r.address }}</dd></template>
            <template v-if="r.phone"><dt>Telefon</dt><dd>{{ r.phone }}</dd></template>
            <template v-if="r.hoursNote"><dt>Iş vaqti</dt><dd>{{ r.hoursNote }}</dd></template>
            <template v-if="r.website"><dt>Sayt</dt><dd class="break-all">{{ r.website }}</dd></template>
            <template v-if="r.lat && r.lng">
              <dt>Nuqta</dt>
              <dd class="tabular-nums">{{ r.lat.toFixed(5) }}, {{ r.lng.toFixed(5) }}</dd>
            </template>
            <template v-if="r.contact"><dt>Aloqa</dt><dd>{{ r.contact }}</dd></template>
          </dl>

          <!-- What a reviewer actually decides: the type, and where. -->
          <div class="mt-4 space-y-3">
            <ChipChoice
              v-model="editsFor(r).city"
              :name="`city-${r.id}`"
              label="Şahar"
              :options="data.cities ?? []"
            />
            <ChipChoice
              v-model="editsFor(r).district"
              :name="`district-${r.id}`"
              label="Tuman"
              clearable="Bilmayman"
              :options="cityOf(r.id)?.districts ?? []"
            />
            <div>
              <label :for="`cat-${r.id}`" class="block text-sm text-muted mb-1">Turi</label>
              <select
                :id="`cat-${r.id}`"
                v-model="editsFor(r).category"
                class="w-full rounded-soft border border-line bg-surface px-3 py-2"
              >
                <option value="">Tanlang…</option>
                <optgroup v-for="c in data.categories" :key="c.slug" :label="c.name">
                  <option
                    v-for="ch in c.children"
                    :key="ch.slug"
                    :value="`${c.slug}/${ch.slug}`"
                  >{{ ch.name }}</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              :disabled="busy === r.id || !editsFor(r).category"
              class="rounded-pill bg-accent px-5 py-2.5 font-medium text-accent-ink
                     disabled:opacity-50"
              @click="decide(r.id, 'publish')"
            >{{ busy === r.id ? '…' : 'Eʼlon qiliş' }}</button>
            <button
              :disabled="busy === r.id"
              class="rounded-pill border border-line px-5 py-2.5 text-muted
                     hover:border-accent disabled:opacity-50"
              @click="decide(r.id, 'reject')"
            >Rad etiş</button>
          </div>
        </li>
      </ol>

      <p class="mt-8 text-xs text-muted">
        Eʼlon qilingan joy darhol saytda körinadi. Keyinroq
        <code class="rounded bg-raised px-1">npm run submissions import</code>
        uni YAML faylga köçiradi — maʼlumotnomaning faktlari git'da, körib
        çiqiş ostida turişi kerak.
      </p>
    </template>
  </div>
</template>
