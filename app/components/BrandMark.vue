<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 26 })
</script>

<template>
  <!-- Inlined rather than an <img>: it is tiny, it appears on every page,
       and a request for a 26px logo is a request the header should not
       have to wait on. -->
  <svg
    :width="size" :height="size" viewBox="0 0 512 512"
    aria-hidden="true" focusable="false" class="shrink-0"
  >
    <defs>
      <linearGradient id="brandmark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#34C4A4" />
        <stop offset="1" stop-color="#0B6D5B" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="104" fill="url(#brandmark)" />
    <path
      fill="#fff" fill-rule="evenodd"
      d="M256 436C256 436 136 316 136 216a120 120 0 1 1 240 0c0 100-120 220-120 220ZM256 170a46 46 0 1 0 0 92 46 46 0 1 0 0-92Z"
    />
  </svg>
</template>
