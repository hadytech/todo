<script setup lang="ts">
/**
 * Which city you are looking at.
 *
 * Two links, not a dropdown or a stored preference. A city is what the
 * page is *about*, so it belongs in the URL: a Khorezm listing shared to
 * a friend has to open on Khorezm, and both pages have to be files a CDN
 * can serve without asking anything.
 *
 * That also means no flicker and no empty first paint — the alternative,
 * filtering one feed on the client, shows the wrong city for a moment
 * every single time.
 */
defineProps<{
  current: string
  cities: { slug: string; name: string; count?: number }[]
  /** Where each city's feed lives. `/` for the default one. */
  hrefFor: (slug: string) => string
}>()
</script>

<template>
  <nav
    class="flex border-b border-line"
    aria-label="Şahar tanlaş"
  >
    <NuxtLink
      v-for="c in cities"
      :key="c.slug"
      :to="hrefFor(c.slug)"
      class="relative flex-1 px-4 py-3 text-center text-sm font-medium hover:bg-raised/40"
      :class="c.slug === current ? 'text-ink' : 'text-muted'"
      :aria-current="c.slug === current ? 'page' : undefined"
    >
      {{ c.name }}
      <span v-if="c.count" class="ml-1 text-xs text-muted tabular-nums">{{ c.count }}</span>
      <!-- The underline is the whole indicator. A filled pill would read
           as a button you press rather than the tab you are on. -->
      <span
        v-if="c.slug === current"
        class="absolute inset-x-4 bottom-0 h-1 rounded-pill bg-accent"
        aria-hidden="true"
      />
    </NuxtLink>
  </nav>
</template>
