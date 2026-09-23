<script setup lang="ts">
/**
 * Search, moved out of the timeline.
 *
 * A feed's job is to show things; a search box at the top of one pushes
 * the first item below the fold. On a wide screen it lives in the right
 * rail, and on a phone it is a whole tab of its own.
 */
const q = ref('')
// Rendered in the right rail and again inside the timeline on narrower
// screens, so the id cannot be a constant.
const fieldId = useId()
const router = useRouter()

function go() {
  const term = q.value.trim()
  if (term) router.push({ path: '/qidiruv', query: { q: term } })
}
</script>

<template>
  <form role="search" @submit.prevent="go">
    <label :for="fieldId" class="sr-only">Joy qidiriş</label>
    <input
      :id="fieldId"
      v-model="q"
      type="search"
      placeholder="Qidiriş"
      class="w-full rounded-pill border border-line bg-raised px-4 py-2.5 text-sm
             placeholder:text-muted focus:bg-surface"
    >
  </form>
</template>
