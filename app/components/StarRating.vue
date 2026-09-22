<script setup lang="ts">
/**
 * Stars, in two modes.
 *
 * Display mode is one `img`-role element with a text label, because a
 * screen reader should hear "4.3 dan 5" and not five separate stars.
 * Input mode is a real radio group, so it arrives at the keyboard and the
 * form already working.
 */
const props = withDefaults(defineProps<{
  /** 0-5. Fractions are rendered as a partial star in display mode. */
  value: number | null
  /** Renders as a radio group and emits. */
  editable?: boolean
  size?: 'sm' | 'md' | 'lg'
  /** Needed only when several input groups share a page. */
  name?: string
}>(), { editable: false, size: 'md', name: 'rating' })

const emit = defineEmits<{ 'update:value': [n: number] }>()

const SIZES = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }

/** Width of the filled overlay, as a percentage of five stars. */
const fill = computed(() => Math.max(0, Math.min(5, props.value ?? 0)) / 5 * 100)

const hovered = ref(0)
const shown = computed(() => hovered.value || Math.round(props.value ?? 0))
</script>

<template>
  <!-- Input: a radio group. The stars are labels, so a click, a tap and
       the arrow keys all work without a single key handler. -->
  <fieldset
    v-if="editable"
    class="flex items-center gap-0.5 border-0 p-0 m-0"
    @mouseleave="hovered = 0"
  >
    <legend class="sr-only">Baho — 1 dan 5 gaça</legend>
    <label
      v-for="n in 5"
      :key="n"
      class="cursor-pointer leading-none p-0.5 rounded
             focus-within:outline focus-within:outline-2 focus-within:outline-accent"
      :class="SIZES[size]"
      @mouseenter="hovered = n"
    >
      <input
        :id="`${name}-${n}`"
        type="radio"
        :name="name"
        :value="n"
        :checked="value === n"
        class="sr-only"
        @change="emit('update:value', n)"
      >
      <span aria-hidden="true" :class="n <= shown ? 'text-accent' : 'text-line'">★</span>
      <span class="sr-only">{{ n }}</span>
    </label>
  </fieldset>

  <!-- Display: one element, one label, and the partial star that an
       average of 4.3 actually deserves. -->
  <span
    v-else
    role="img"
    :aria-label="value === null ? 'Baho yoʻq' : `${value.toFixed(1)} — 5 dan`"
    class="relative inline-block leading-none whitespace-nowrap select-none"
    :class="SIZES[size]"
  >
    <span aria-hidden="true" class="text-line">★★★★★</span>
    <span
      aria-hidden="true"
      class="absolute inset-0 overflow-hidden text-accent"
      :style="{ width: `${fill}%` }"
    >★★★★★</span>
  </span>
</template>
