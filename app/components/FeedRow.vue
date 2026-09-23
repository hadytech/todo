<script setup lang="ts">
/**
 * One place, in the shape of a timeline post.
 *
 * Full bleed with a hairline underneath rather than a card with a gap:
 * a feed reads as one continuous surface, and the separators do the
 * work that card edges would. The whole row is the link, so the tap
 * target is the row and not a title inside it.
 */
const props = defineProps<{
  business: {
    slug: string; name: string; address?: string
    categoryName: string; districtName: string; price?: number
    icon?: string
  }
}>()

const { get, load } = useRatings()
const rating = computed(() => get(props.business.slug))

// Deduplicated in the composable, so a page of twenty rows asks once.
onMounted(load)
</script>

<template>
  <article class="relative border-b border-line transition-colors hover:bg-raised/40">
    <NuxtLink :to="`/b/${business.slug}`" class="flex gap-3 px-4 py-3">
      <!-- Stands in for an avatar. A category is the most honest thing
           a listing with no photo can show. -->
      <span
        class="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-pill
               bg-accent-soft text-lg"
        aria-hidden="true"
      >{{ business.icon ?? '📍' }}</span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-1.5">
          <span class="font-semibold leading-snug">{{ business.name }}</span>
          <span class="text-sm text-muted">· {{ business.districtName }}</span>
          <span v-if="business.price" class="text-sm text-accent">
            · {{ '$'.repeat(business.price) }}
          </span>
        </div>

        <p class="text-sm text-muted">{{ business.categoryName }}</p>
        <p v-if="business.address" class="mt-0.5 text-sm text-muted/80 truncate">
          {{ business.address }}
        </p>

        <!-- The action row. Counts only — voting belongs on the place's
             own page, where the review being voted on is visible. -->
        <div v-if="rating?.count" class="mt-2 flex items-center gap-4 text-sm">
          <span v-if="rating.average !== null" class="flex items-center gap-1.5">
            <StarRating :value="rating.average" size="sm" />
            <span class="font-medium tabular-nums">{{ rating.average.toFixed(1) }}</span>
          </span>
          <span class="flex items-center gap-1 text-muted">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
            </svg>
            <span class="tabular-nums">{{ rating.count }}</span>
          </span>
        </div>
      </div>
    </NuxtLink>
  </article>
</template>
