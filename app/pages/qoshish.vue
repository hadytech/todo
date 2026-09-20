<script setup lang="ts">
const config = useRuntimeConfig()
const repo = config.public.repoUrl as string

useHead({
  title: 'Joy qoʻşiş — yalp.uz',
  meta: [{ name: 'description', content: 'yalp.uz maʼlumotnomasiga yangi joy qoʻşiş yoki maʼlumotni tuzatiş.' }],
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-2">Joy qoʻşiş</h1>
    <p class="opacity-75 mb-6">
      yalp.uz ochiq maʼlumotnoma — hamma maʼlumot ochiq saqlanadi va
      istagan odam tuzatiş kiritişi mumkin.
    </p>

    <section class="mb-8">
      <h2 class="font-semibold mb-2">Eng oson yoʻl</h2>
      <p class="text-sm opacity-75 mb-3">
        Formani toʻldiring — texnik bilim kerak emas. Biz tekşirib qoʻşamiz.
      </p>
      <a
        :href="`${repo}/issues/new?template=joy-qoshish.yml`"
        rel="noopener"
        class="inline-block rounded-lg bg-teal-600 text-white px-5 py-3 font-medium"
      >Forma orqali qoʻşiş</a>
      <p class="text-xs opacity-55 mt-2">GitHub hisobi kerak boʻladi (bepul).</p>
    </section>

    <section class="mb-8">
      <h2 class="font-semibold mb-2">Oʻzingiz qoʻşmoqçimisiz?</h2>
      <p class="text-sm opacity-75 mb-2">
        Har bir joy — bitta YAML fayl. Pull request yuboring, tekşiruv
        avtomatik işlaydi.
      </p>
      <pre class="text-xs bg-neutral-100 dark:bg-neutral-900 rounded-lg p-3 overflow-x-auto"><code>name: Çorsu Restorani
category: ovqatlanish/restoran
district: shayxontohur
address: Çorsu bozori yonida, Toşkent
location: { lat: 41.3264, lng: 69.2347 }
status: published</code></pre>
      <p class="text-sm mt-3">
        <a :href="repo" rel="noopener" class="text-teal-600 dark:text-teal-400">Repozitoriya</a>
      </p>
    </section>

    <section>
      <h2 class="font-semibold mb-2">Alifbo haqida</h2>
      <p class="text-sm opacity-75">
        Nomlarni yangi alifboda yozing: <b>ö ğ ç ş</b>
        (<span class="opacity-60">oʻ → ö, gʻ → ğ, ch → ç, sh → ş</span>).
        Bilmasangiz, odatdagiça yozing — biz tuzatamiz. Qidiruv baribir
        har qanday alifboda işlaydi.
      </p>
    </section>
  </div>
</template>
