<script setup lang="ts">
const { toggle } = useTheme()
</script>

<template>
  <!--
    Both icons are always in the DOM and CSS decides which one shows.

    The alternative — picking the icon in JavaScript — cannot work here:
    the page is prerendered with no knowledge of the visitor's theme, so
    the server would guess, and hydration would flip it. Letting CSS
    resolve it means the correct icon is right in the very first frame,
    with no JavaScript involved at all.
  -->
  <button
    type="button"
    class="theme-toggle grid size-9 place-items-center rounded-pill text-muted
           hover:bg-raised hover:text-ink"
    @click="toggle"
  >
    <span class="sr-only">Kunduzgi va tungi köriniş</span>

    <svg class="icon-moon size-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true"
         stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>

    <svg class="icon-sun size-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden="true"
         stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  </button>
</template>

<style>
/* Light is the default, so offer the moon. */
.theme-toggle .icon-sun { display: none; }
.theme-toggle .icon-moon { display: block; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .theme-toggle .icon-sun { display: block; }
  :root:not([data-theme="light"]) .theme-toggle .icon-moon { display: none; }
}

:root[data-theme="dark"] .theme-toggle .icon-sun { display: block; }
:root[data-theme="dark"] .theme-toggle .icon-moon { display: none; }

:root[data-theme="light"] .theme-toggle .icon-sun { display: none; }
:root[data-theme="light"] .theme-toggle .icon-moon { display: block; }
</style>
