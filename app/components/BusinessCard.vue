<script setup lang="ts">
defineProps<{
  business: {
    slug: string; name: string; address: string
    categoryName: string; districtName: string; price?: number
  }
}>()
</script>

<template>
  <NuxtLink
    :to="`/b/${business.slug}`"
    class="block py-3 border-b border-neutral-200 dark:border-neutral-800 hover:opacity-80"
  >
    <div class="font-medium">{{ business.name }}</div>
    <div class="text-sm opacity-70">
      {{ business.categoryName }} · {{ business.districtName }}
      <span v-if="business.price"> · {{ '$'.repeat(business.price) }}</span>
    </div>
    <div class="text-sm opacity-55">{{ business.address }}</div>
  </NuxtLink>
</template>
