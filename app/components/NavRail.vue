<script setup lang="ts">
/**
 * The navigation, in both of its shapes.
 *
 * A rail down the left on a wide screen and a bar across the bottom on
 * a phone — one list of destinations, rendered twice, because keeping
 * two copies in sync by hand is how a link ends up in one and not the
 * other.
 */
defineProps<{ variant: 'rail' | 'bar' }>()

const { user, enabled, loaded } = useAuth()

/**
 * Paths stay ASCII even though the labels do not: a slug is a URL, and
 * the alphabet rule applies to what people read, not to what they type
 * into an address bar.
 */
const LINKS = [
  { to: '/', label: 'Lenta', icon: 'M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8' },
  { to: '/qidiruv', label: 'Qidiruv', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2' },
  { to: '/qoshish', label: 'Qöşiş', icon: 'M12 5v14M5 12h14' },
]
</script>

<template>
  <!-- Wide screens: a sticky rail. -->
  <nav v-if="variant === 'rail'" class="flex flex-col gap-1" aria-label="Asosiy">
    <NuxtLink
      v-for="l in LINKS"
      :key="l.to"
      :to="l.to"
      class="group flex items-center gap-4 rounded-pill px-3.5 py-2.5 text-lg
             hover:bg-raised"
      active-class="font-bold"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6 shrink-0" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round" aria-hidden="true">
        <path :d="l.icon" />
      </svg>
      <span>{{ l.label }}</span>
    </NuxtLink>

    <NuxtLink
      v-if="loaded && enabled"
      to="/kirish"
      class="flex items-center gap-4 rounded-pill px-3.5 py-2.5 text-lg hover:bg-raised"
      active-class="font-bold"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6 shrink-0" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
      <span class="truncate">{{ user ? user.name : 'Kiriş' }}</span>
    </NuxtLink>

    <NuxtLink
      to="/qoshish"
      class="mt-3 rounded-pill bg-accent px-4 py-3 text-center font-bold text-accent-ink
             hover:opacity-90"
    >Joy qöşiş</NuxtLink>
  </nav>

  <!--
    Phones: a bar along the bottom. It sits at 0 and adds the safe-area
    inset to its own padding, so it clears the home indicator instead of
    floating above it.
  -->
  <nav
    v-else
    class="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-canvas/95 backdrop-blur"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
    aria-label="Asosiy"
  >
    <NuxtLink
      v-for="l in LINKS"
      :key="l.to"
      :to="l.to"
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted"
      active-class="text-accent font-semibold"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path :d="l.icon" />
      </svg>
      {{ l.label }}
    </NuxtLink>
    <NuxtLink
      v-if="loaded && enabled"
      to="/kirish"
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted"
      active-class="text-accent font-semibold"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
      Men
    </NuxtLink>
  </nav>
</template>
