<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error?.statusCode === 404)

useHead({ title: notFound.value ? 'Sahifa topilmadi — yalp.uz' : 'Xatolik — yalp.uz' })
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center bg-canvas text-ink">
    <p class="text-5xl font-bold opacity-20">{{ error?.statusCode ?? '?' }}</p>

    <h1 class="text-xl font-semibold">
      {{ notFound ? 'Bunday sahifa yöq' : 'Nimadir notöğri ketdi' }}
    </h1>

    <p class="text-muted text-sm max-w-sm">
      {{ notFound
        ? 'Havola eskirgan bölişi mumkin, yoki bu joy hali qöşilmagan.'
        : 'Birozdan söng qayta urinib köring.' }}
    </p>

    <div class="flex gap-3 text-sm">
      <NuxtLink to="/" class="rounded-soft bg-accent text-accent-ink px-4 py-2">Bosh sahifa</NuxtLink>
      <NuxtLink to="/qidiruv" class="rounded-soft border border-line px-4 py-2">
        Qidiruv
      </NuxtLink>
    </div>
  </div>
</template>
