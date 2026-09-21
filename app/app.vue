<script setup lang="ts">
const { indexable, repoUrl } = useRuntimeConfig().public

// robots.txt asks crawlers not to fetch; this tells any that fetched
// anyway not to index. A page already marked noindex stays noindex.
if (!indexable) {
  useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
}
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-canvas text-ink">
    <a
      href="#asosiy"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-soft
             focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
    >Asosiy qismga oʻtiş</a>

    <header class="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div class="mx-auto max-w-4xl px-4 h-14 flex items-center gap-3">
        <NuxtLink to="/" class="font-bold text-lg tracking-tight">
          yalp<span class="text-accent">.uz</span>
        </NuxtLink>

        <nav class="ml-auto flex items-center gap-1 text-sm">
          <NuxtLink
            to="/qidiruv"
            class="rounded-pill px-3 py-1.5 text-muted hover:bg-raised hover:text-ink"
          >Qidiruv</NuxtLink>
          <NuxtLink
            to="/qoshish"
            class="rounded-pill px-3 py-1.5 text-muted hover:bg-raised hover:text-ink"
          >Joy qoʻşiş</NuxtLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>

    <main id="asosiy" class="flex-1 mx-auto w-full max-w-4xl px-4 py-7">
      <NuxtPage />
    </main>

    <footer class="border-t border-line mt-10">
      <div class="mx-auto max-w-4xl px-4 py-7 text-sm">
        <p class="text-muted mb-2">
          Toşkent joylari maʼlumotnomasi — oçiq kodli, oçiq maʼlumotli.
        </p>
        <nav class="flex flex-wrap gap-x-5 gap-y-1">
          <NuxtLink to="/qoshish" class="text-muted hover:text-ink">Joy qoʻşiş</NuxtLink>
          <NuxtLink to="/qidiruv" class="text-muted hover:text-ink">Qidiruv</NuxtLink>
          <a :href="repoUrl" rel="noopener" class="text-muted hover:text-ink">Manba kodi</a>
        </nav>
      </div>
    </footer>
  </div>
</template>
