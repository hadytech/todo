<script setup lang="ts">
/**
 * Pick one, by tapping it.
 *
 * This replaces three `<select>` elements on the add-a-place form. A
 * native select is not broken, but on a phone it is a modal wheel: you
 * tap, a picker covers the page, you spin, you confirm — and you cannot
 * see the other choices or how many there are until you are inside it.
 * People reported the three pickers as simply "not working", and while
 * the DOM behaved correctly under every browser available here, a
 * control whose options are invisible until you commit to opening it is
 * a control that gets reported that way.
 *
 * Chips show every option at once, take one tap, and are the same shape
 * as the filter chips already used for browsing.
 *
 * Radio inputs rather than buttons with `aria-pressed`: a radio group is
 * what this is, so arrow keys, form semantics and screen readers all work
 * without a line of JavaScript.
 */
const props = defineProps<{
  /** Radio group name. Must be unique on the page. */
  name: string
  options: { slug: string; name: string; icon?: string }[]
  label: string
  /** Shown instead of the chips when there is nothing to choose from yet. */
  empty?: string
  /** Offered as a first chip meaning "no answer". */
  clearable?: string
}>()

const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <fieldset class="border-0 p-0 m-0">
    <legend class="block text-sm text-muted mb-2">{{ label }}</legend>

    <p v-if="!options.length" class="text-sm text-muted">{{ empty ?? '—' }}</p>

    <!-- Wraps rather than scrolls sideways: a horizontal scroller hides
         options behind an edge, which is the problem this control exists
         to solve. -->
    <div v-else class="flex flex-wrap gap-2">
      <label
        v-if="clearable"
        class="cursor-pointer rounded-pill border px-3.5 py-2 text-sm
               focus-within:outline focus-within:outline-2 focus-within:outline-accent"
        :class="model === ''
          ? 'border-accent bg-accent-soft text-accent font-medium'
          : 'border-line hover:border-accent'"
      >
        <input
          :id="`${id}-none`"
          v-model="model"
          type="radio"
          :name="name"
          value=""
          class="sr-only"
        >
        {{ clearable }}
      </label>

      <label
        v-for="o in options"
        :key="o.slug"
        class="cursor-pointer rounded-pill border px-3.5 py-2 text-sm
               focus-within:outline focus-within:outline-2 focus-within:outline-accent"
        :class="model === o.slug
          ? 'border-accent bg-accent-soft text-accent font-medium'
          : 'border-line hover:border-accent'"
      >
        <input
          :id="`${id}-${o.slug}`"
          v-model="model"
          type="radio"
          :name="name"
          :value="o.slug"
          class="sr-only"
        >
        <span v-if="o.icon" aria-hidden="true">{{ o.icon }}</span>
        {{ o.name }}
      </label>
    </div>
  </fieldset>
</template>
