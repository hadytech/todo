<script setup lang="ts">
defineProps<{
  business: {
    slug: string; name: string; address?: string
    categoryName: string; districtName: string; price?: number
  }
}>()
</script>

<template>
  <!-- A card rather than a list row: at phone width it gives a bigger tap
       target, and on a wide screen these tile into a grid instead of
       becoming one very long line of text. -->
  <NuxtLink
    :to="`/b/${business.slug}`"
    class="card block rounded-soft border border-line bg-surface p-4
           hover:border-accent hover:shadow-sm"
  >
    <div class="font-medium leading-snug">{{ business.name }}</div>
    <div class="mt-1 text-sm text-muted">
      {{ business.categoryName }} · {{ business.districtName }}
      <span v-if="business.price" class="text-accent">· {{ '$'.repeat(business.price) }}</span>
    </div>
    <div v-if="business.address" class="mt-0.5 text-sm text-muted/75">{{ business.address }}</div>
  </NuxtLink>
</template>
