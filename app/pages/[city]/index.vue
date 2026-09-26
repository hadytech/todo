<script setup lang="ts">
/**
 * One city's timeline, for every city except the default one.
 *
 * A dynamic segment rather than a file per city, so a third region is a
 * row in data/cities.yaml and nothing else. The cost is that this route
 * also matches `/anything-else`, which is why an unknown slug 404s here
 * rather than rendering an empty feed that looks like a real page.
 */
const route = useRoute()
const slug = computed(() => String(route.params.city))

const { data: facets } = await useFetch('/api/facets')
const city = computed(() => facets.value?.cities?.find((c) => c.slug === slug.value))

if (!city.value) {
  throw createError({ statusCode: 404, statusMessage: 'Bunday şahar yöq', fatal: true })
}
// The default city is `/`. Serving it here too would be the same page at
// two addresses, competing with itself in search results.
if (city.value.default) await navigateTo('/', { redirectCode: 301 })

const site = useRuntimeConfig().public.siteUrl as string

useHead({
  title: `${city.value.name} — yalp.uz`,
  meta: [{
    name: 'description',
    content: `${city.value.name} joylari: restoran, kafe, dökon va boşqalar. `
      + 'Hisobsiz baho va şarh yozing.',
  }],
  link: [{ rel: 'canonical', href: `${site}/${city.value.slug}` }],
})
</script>

<template>
  <CityFeed :city="slug" />
</template>
