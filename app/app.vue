<script setup lang="ts">
const { indexable, repoUrl } = useRuntimeConfig().public

/**
 * The header's account control.
 *
 * Nothing is rendered until `/api/auth/me` answers, because the three
 * states — signed in, signed out, and no write side at all — look
 * different and guessing wrong means the header visibly changes under the
 * reader a moment after they start looking at it.
 */
const { user, enabled, loaded, refresh } = useAuth()
onMounted(refresh)

// robots.txt asks crawlers not to fetch; this tells any that fetched
// anyway not to index. A page already marked noindex stays noindex.
if (!indexable) {
  useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
}
</script>

<template>
  <div class="min-h-dvh bg-canvas text-ink">
    <a
      href="#asosiy"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-soft
             focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
    >Asosiy qismga ötiş</a>

    <!--
      Three columns on a wide screen, one on a phone. The centre column
      is a fixed 600px with a hairline on each side rather than a card
      with a gap: a timeline reads as one continuous surface, and the
      separators between items do the work that card edges would.
    -->
    <div class="mx-auto flex w-full max-w-6xl justify-center gap-0">
      <!-- Left rail. -->
      <div class="hidden lg:block w-[248px] shrink-0 px-2">
        <div class="sticky top-0 flex h-dvh flex-col py-3">
          <NuxtLink
            to="/"
            class="mb-3 flex items-center gap-2 rounded-pill px-3.5 py-2 font-extrabold text-lg
                   tracking-tight hover:bg-raised"
          >
            <BrandMark />
            <span>yalp<span class="text-accent">.uz</span></span>
          </NuxtLink>

          <NavRail variant="rail" />

          <div class="mt-auto pb-2">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <!-- The timeline. -->
      <main
        id="asosiy"
        class="w-full min-w-0 lg:max-w-[600px] lg:border-x border-line pb-20 lg:pb-0"
      >
        <!-- Phones get a slim bar; the rail already names the site on desktop. -->
        <header
          class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line
                 bg-canvas/85 px-4 backdrop-blur lg:hidden"
        >
          <NuxtLink to="/" class="flex items-center gap-2 font-extrabold tracking-tight">
            <BrandMark />
            <span>yalp<span class="text-accent">.uz</span></span>
          </NuxtLink>
          <div class="ml-auto"><ThemeToggle /></div>
        </header>

        <NuxtPage />
      </main>

      <!-- Right rail: the things a timeline pushes out of the way. -->
      <aside class="hidden xl:block w-[320px] shrink-0 px-5 py-3">
        <div class="sticky top-3 space-y-4">
          <SideSearch />
          <div class="rounded-soft border border-line p-4 text-sm">
            <p class="font-semibold">yalp.uz</p>
            <p class="mt-1 text-muted text-pretty">
              Toşkent joylari maʼlumotnomasi — oçiq kodli, oçiq maʼlumotli.
            </p>
            <nav class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-muted">
              <NuxtLink to="/qoshish" class="hover:text-ink">Joy qöşiş</NuxtLink>
              <NuxtLink to="/maxfiylik" class="hover:text-ink">Maxfiylik</NuxtLink>
              <a :href="repoUrl" rel="noopener" class="hover:text-ink">Manba kodi</a>
            </nav>
          </div>
        </div>
      </aside>
    </div>

    <NavRail variant="bar" class="lg:hidden" />
  </div>
</template>
