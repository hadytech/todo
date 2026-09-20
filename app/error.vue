<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error?.statusCode === 404)

useHead({ title: notFound.value ? 'Sahifa topilmadi — yalp.uz' : 'Xatolik — yalp.uz' })
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center
              bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <p class="text-5xl font-bold opacity-20">{{ error?.statusCode ?? '?' }}</p>

    <h1 class="text-xl font-semibold">
      {{ notFound ? 'Bunday sahifa yoʻq' : 'Nimadir notoʻğri ketdi' }}
    </h1>

    <p class="opacity-70 text-sm max-w-sm">
      {{ notFound
        ? 'Havola eskirgan boʻlişi mumkin, yoki bu joy hali qoʻşilmagan.'
        : 'Birozdan soʻng qayta urinib koʻring.' }}
    </p>

    <div class="flex gap-3 text-sm">
      <NuxtLink to="/" class="rounded-lg bg-teal-600 text-white px-4 py-2">Bosh sahifa</NuxtLink>
      <NuxtLink to="/qidiruv" class="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2">
        Qidiruv
      </NuxtLink>
    </div>
  </div>
</template>
