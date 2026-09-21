<script setup lang="ts">
const { indexable, repoUrl, analytics, siteVerification } = useRuntimeConfig().public

// robots.txt asks crawlers not to fetch; this tells any that fetched
// anyway not to index. A page already marked noindex stays noindex.
if (!indexable) {
  useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
}

if (siteVerification) {
  useHead({ meta: [{ name: 'google-site-verification', content: siteVerification as string }] })
}

/**
 * Analytics load only when a site code is configured, and never in dev —
 * otherwise local page views pollute the numbers the alphabet decision
 * will rest on.
 */
if (analytics && !import.meta.dev) {
  useHead({
    script: [{
      'data-goatcounter': `https://${analytics}.goatcounter.com/count`,
      'src': 'https://gc.zgo.at/count.js',
      'async': true,
    }],
  })
}
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <a
      href="#asosiy"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg
             focus:bg-teal-600 focus:px-4 focus:py-2 focus:text-white"
    >Asosiy qismga oʻtiş</a>

    <header class="border-b border-neutral-200 dark:border-neutral-800">
      <div class="mx-auto max-w-3xl px-4 h-14 flex items-center gap-4">
        <NuxtLink to="/" class="font-bold text-lg tracking-tight">
          yalp<span class="text-teal-600 dark:text-teal-400">.uz</span>
        </NuxtLink>
        <nav class="ml-auto flex gap-4 text-sm">
          <NuxtLink to="/qidiruv" class="opacity-70 hover:opacity-100">Qidiruv</NuxtLink>
          <NuxtLink to="/qoshish" class="opacity-70 hover:opacity-100">Joy qoʻşiş</NuxtLink>
        </nav>
      </div>
    </header>

    <main id="asosiy" class="flex-1 mx-auto w-full max-w-3xl px-4 py-6">
      <NuxtPage />
    </main>

    <footer class="border-t border-neutral-200 dark:border-neutral-800 mt-8">
      <div class="mx-auto max-w-3xl px-4 py-6 text-sm">
        <p class="opacity-60 mb-2">Toşkent joylari maʼlumotnomasi — ochiq kodli, ochiq maʼlumotli.</p>
        <nav class="flex flex-wrap gap-x-4 gap-y-1">
          <NuxtLink to="/qoshish" class="opacity-70 hover:opacity-100">Joy qoʻşiş</NuxtLink>
          <a :href="repoUrl" rel="noopener" class="opacity-70 hover:opacity-100">Manba kodi</a>
        </nav>
      </div>
    </footer>
  </div>
</template>
