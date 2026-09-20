<template>
  <div class="min-h-dvh flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <header class="border-b border-neutral-200 dark:border-neutral-800">
      <div class="mx-auto max-w-3xl px-4 h-14 flex items-center gap-4">
        <NuxtLink to="/" class="font-bold text-lg tracking-tight">
          yalp<span class="text-teal-600 dark:text-teal-400">.uz</span>
        </NuxtLink>
        <NuxtLink to="/qidiruv" class="ml-auto text-sm opacity-70 hover:opacity-100">Qidiruv</NuxtLink>
      </div>
    </header>

    <main class="flex-1 mx-auto w-full max-w-3xl px-4 py-6">
      <NuxtPage />
    </main>

    <footer class="border-t border-neutral-200 dark:border-neutral-800 mt-8">
      <div class="mx-auto max-w-3xl px-4 py-6 text-sm opacity-60">
        <p>yalp.uz — Toşkent joylari maʼlumotnomasi. Ochiq kodli.</p>
      </div>
    </footer>
  </div>
</template>
