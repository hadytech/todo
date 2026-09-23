<script setup lang="ts">
const { user, enabled, ensure, logout } = useAuth()
const route = useRoute()

const email = ref('')
const name = ref('')
const sent = ref(false)
const busy = ref(false)
const error = ref('')

await ensure()

/**
 * The magic link comes back to `/?kirish=…`, but people also land here
 * directly after a failed one.
 */
const NOTICE: Record<string, string> = {
  eskirgan: 'Havola eskirgan yoki allaqaçon işlatilgan. Yangisini sörang.',
  xato: 'Havola notöğri. Yangisini sörang.',
}
const notice = computed(() => NOTICE[String(route.query.kirish ?? '')] ?? '')

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await $fetch('/api/auth/request', {
      method: 'POST',
      body: { email: email.value, name: name.value || undefined },
    })
    sent.value = true
  } catch (e: unknown) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Yuborib bölmadi. Qayta urinib köring.'
  } finally {
    busy.value = false
  }
}

useHead({
  title: 'Kiriş | yalp.uz',
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <div class="mx-auto max-w-sm">
    <h1 class="text-2xl font-bold">Kiriş</h1>

    <template v-if="user">
      <p class="mt-4">
        Siz <strong>{{ user.name }}</strong> sifatida kirgansiz.
      </p>
      <div class="mt-4 flex gap-3">
        <NuxtLink to="/" class="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          Bosh sahifa
        </NuxtLink>
        <button
          class="rounded-pill border border-line px-4 py-2 text-sm"
          @click="logout"
        >Çiqiş</button>
      </div>
    </template>

    <p v-else-if="enabled === false" class="mt-4 text-muted">
      Sharhlar hozirça oçiq emas. Sayt maʼlumotlari işlayapti, lekin baho va
      izohlar uçun maʼlumotlar bazasi hali ulanmagan.
    </p>

    <template v-else-if="sent">
      <p class="mt-4">
        <strong>{{ email }}</strong> manziliga havola yubordik.
      </p>
      <p class="mt-2 text-sm text-muted">
        Xatni oçib havolani bosing. Havola 20 daqiqa amal qiladi.
        Xat kelmasa, spam papkasini tekşiring.
      </p>
    </template>

    <template v-else>
      <p class="mt-2 text-sm text-muted">
        Parol yöq. Manzilingizni yozing — kiriş havolasini yuboramiz.
      </p>

      <p v-if="notice" class="mt-4 rounded-soft bg-raised px-3 py-2 text-sm">{{ notice }}</p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <div>
          <label for="login-email" class="block text-sm text-muted mb-1">Elektron poçta</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            inputmode="email"
            placeholder="ism@misol.uz"
            class="w-full rounded-soft border border-line bg-surface px-3 py-2"
          >
        </div>
        <div>
          <label for="login-name" class="block text-sm text-muted mb-1">
            Ismingiz <span class="text-muted/70">— sharhlarda körinadi</span>
          </label>
          <input
            id="login-name"
            v-model="name"
            type="text"
            maxlength="40"
            autocomplete="nickname"
            placeholder="Aziz R."
            class="w-full rounded-soft border border-line bg-surface px-3 py-2"
          >
        </div>

        <p v-if="error" class="text-sm text-accent">{{ error }}</p>

        <button
          type="submit"
          :disabled="busy"
          class="w-full rounded-pill bg-accent px-4 py-2.5 font-medium text-accent-ink
                 disabled:opacity-60"
        >{{ busy ? 'Yuborilyapti…' : 'Havola yuborish' }}</button>
      </form>

      <p class="mt-4 text-xs text-muted">
        Manzilingiz faqat kiriş uçun işlatiladi va saytda hech qaçon
        körsatilmaydi.
      </p>
    </template>
  </div>
</template>
