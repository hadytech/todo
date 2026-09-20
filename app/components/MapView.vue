<script setup lang="ts">
/**
 * Lazy MapLibre + PMTiles map.
 *
 * MapLibre plus its CSS is roughly 200KB — more than the rest of a
 * business page put together. So nothing is imported until the visitor
 * actually asks for the map, and every path degrades to the plain
 * OpenStreetMap link, which works with no JavaScript at all.
 */
interface Marker { lat: number; lng: number; name: string; slug?: string }

const props = withDefaults(defineProps<{
  markers: Marker[]
  zoom?: number
  height?: string
}>(), { zoom: 15, height: '20rem' })

const config = useRuntimeConfig().public
const el = ref<HTMLElement | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')
const failure = ref('')

const centre = computed(() => {
  if (!props.markers.length) return { lat: 41.3111, lng: 69.2797 } // Toşkent
  const lat = props.markers.reduce((s, m) => s + m.lat, 0) / props.markers.length
  const lng = props.markers.reduce((s, m) => s + m.lng, 0) / props.markers.length
  return { lat, lng }
})

const osmLink = computed(() => {
  const m = props.markers[0] ?? centre.value
  return `https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=${props.zoom}/${m.lat}/${m.lng}`
})

async function show() {
  if (state.value !== 'idle') return
  state.value = 'loading'

  try {
    const [{ default: maplibregl }, { Protocol }, { layers, namedFlavor }] = await Promise.all([
      import('maplibre-gl'),
      import('pmtiles'),
      import('@protomaps/basemaps'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])

    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    await nextTick()
    if (!el.value) throw new Error('kontejner topilmadi')

    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches

    const map = new maplibregl.Map({
      container: el.value,
      center: [centre.value.lng, centre.value.lat],
      zoom: props.markers.length > 1 ? 11 : props.zoom,
      attributionControl: { compact: true },
      style: {
        version: 8,
        glyphs: `${config.glyphsUrl}/{fontstack}/{range}.pbf`,
        sources: {
          protomaps: {
            type: 'vector',
            url: `pmtiles://${config.pmtilesUrl}`,
            attribution: '<a href="https://openstreetmap.org">OpenStreetMap</a>',
          },
        },
        // Labels in Uzbek where OSM carries name:uz, falling back to the
        // local name otherwise.
        layers: layers('protomaps', namedFlavor(dark ? 'dark' : 'light'), { lang: 'uz' }),
      },
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    for (const m of props.markers) {
      const marker = new maplibregl.Marker({ color: '#0f766e' }).setLngLat([m.lng, m.lat])
      if (props.markers.length > 1 && m.slug) {
        marker.setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(
          `<a href="/b/${m.slug}" style="color:#0f766e;font-weight:600">${escapeHtml(m.name)}</a>`,
        ))
      }
      marker.addTo(map)
    }

    if (props.markers.length > 1) {
      const b = new maplibregl.LngLatBounds()
      for (const m of props.markers) b.extend([m.lng, m.lat])
      map.fitBounds(b, { padding: 48, maxZoom: 15 })
    }

    // A missing or unreachable .pmtiles archive surfaces here. Fall back
    // rather than leaving the visitor staring at an empty grey box.
    map.on('error', (e: { error?: Error }) => {
      if (state.value === 'ready') return
      state.value = 'failed'
      failure.value = e.error?.message ?? 'xarita yuklanmadi'
    })
    map.on('load', () => { state.value = 'ready' })
  } catch (e) {
    state.value = 'failed'
    failure.value = (e as Error).message
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}
</script>

<template>
  <div>
    <div
      v-show="state === 'loading' || state === 'ready'"
      ref="el"
      class="w-full rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800"
      :style="{ height }"
    />

    <button
      v-if="state === 'idle'"
      type="button"
      class="w-full rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700
             text-sm py-6 hover:border-teal-600 hover:text-teal-600"
      @click="show"
    >
      Xaritani koʻrsatiş
    </button>

    <p v-if="state === 'loading'" class="text-sm opacity-60 mt-2">Xarita yuklanmoqda…</p>

    <p v-if="state === 'failed'" class="text-sm opacity-70">
      Xaritani yuklab boʻlmadi.
      <a :href="osmLink" rel="noopener" class="text-teal-600 dark:text-teal-400">
        OpenStreetMap'da oçiş
      </a>
      <span class="block opacity-50 text-xs mt-1">{{ failure }}</span>
    </p>

    <!-- Always present, works without JavaScript. -->
    <p v-if="state !== 'failed'" class="text-sm mt-2">
      <a :href="osmLink" rel="noopener" class="text-teal-600 dark:text-teal-400 opacity-70">
        OpenStreetMap'da oçiş
      </a>
    </p>
  </div>
</template>
