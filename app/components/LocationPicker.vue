<script setup lang="ts">
/**
 * Where the place is. Two controls, no prose.
 *
 * This component used to carry its own status line for geolocation and
 * for the map, which meant the page could show three unrelated
 * messages at once. It reports upward now, so there is exactly one
 * place on the page where anything is said.
 */
const model = defineModel<{ lat: number; lng: number } | null>({ default: null })
const emit = defineEmits<{ status: [tone: 'info' | 'error', text: string] }>()

const config = useRuntimeConfig().public
const asset = useAssetUrl()

const mapEl = ref<HTMLElement | null>(null)
const mapOpen = ref(false)
const busy = ref(false)

/** Tashkent's bounding box — the same one the schema enforces. */
const IN_TASHKENT = (c: { lat: number; lng: number }) =>
  c.lat >= 41.15 && c.lat <= 41.45 && c.lng >= 69.10 && c.lng <= 69.55

let marker: { setLngLat: (c: [number, number]) => void } | null = null
let map: { flyTo: (o: object) => void } | null = null

// The pin can also be set from above, by a pasted link. Without this the
// marker would sit at the old spot and contradict the printed figures.
watch(model, (c) => {
  if (!c) return
  marker?.setLngLat([c.lng, c.lat])
  map?.flyTo({ center: [c.lng, c.lat], zoom: 16 })
})

function fromGps() {
  if (!navigator.geolocation) return
  busy.value = true
  navigator.geolocation.getCurrentPosition(
    (p) => {
      busy.value = false
      const c = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }
      // Someone adding a Tashkent shop from another country is using the
      // wrong button, and a pin in Berlin helps nobody.
      if (!IN_TASHKENT(c)) return emit('status', 'error', 'Siz Toşkentda emassiz — xaritadan belgilang.')
      model.value = c
    },
    () => { busy.value = false; emit('status', 'error', 'Joylaşuvga ruxsat berilmadi.') },
    { enableHighAccuracy: true, timeout: 10_000 },
  )
}

/** MapLibre is ~200KB, and most submissions never need it. */
async function openMap() {
  if (mapOpen.value) return
  mapOpen.value = true
  try {
    const [{ default: maplibregl }, { Protocol }, { layers, namedFlavor }] = await Promise.all([
      import('maplibre-gl'),
      import('pmtiles'),
      import('@protomaps/basemaps'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
    maplibregl.addProtocol('pmtiles', new Protocol().tile)
    await nextTick()
    if (!mapEl.value) throw new Error('kontejner')

    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const start = model.value ?? { lat: 41.3111, lng: 69.2797 }

    const m = new maplibregl.Map({
      container: mapEl.value,
      center: [start.lng, start.lat],
      zoom: model.value ? 16 : 12,
      attributionControl: { compact: true },
      style: {
        version: 8,
        glyphs: `${config.glyphsUrl}/{fontstack}/{range}.pbf`,
        sources: {
          protomaps: {
            type: 'vector',
            url: `pmtiles://${/^https?:/.test(config.pmtilesUrl as string)
              ? config.pmtilesUrl
              : asset(String(config.pmtilesUrl).replace(/^\//, ''))}`,
            attribution: '<a href="https://openstreetmap.org">OpenStreetMap</a>',
          },
        },
        layers: layers('protomaps', namedFlavor(dark ? 'dark' : 'light'), { lang: 'uz' }),
      },
    })
    map = m as never

    const mk = new maplibregl.Marker({ color: '#0B6D5B', draggable: true })
      .setLngLat([start.lng, start.lat]).addTo(m)
    marker = mk as never

    const place = (lat: number, lng: number) => {
      const c = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) }
      model.value = c
      mk.setLngLat([c.lng, c.lat])
    }
    mk.on('dragend', () => { const { lat, lng } = mk.getLngLat(); place(lat, lng) })
    m.on('click', (e: { lngLat: { lat: number; lng: number } }) => place(e.lngLat.lat, e.lngLat.lng))
    m.on('error', () => emit('status', 'error', 'Xarita yuklanmadi — havola joylaştiring.'))
  } catch {
    mapOpen.value = false
    emit('status', 'error', 'Xarita yuklanmadi — havola joylaştiring.')
  }
}
</script>

<template>
  <div>
    <!-- Once there is a pin, the controls stop competing for attention. -->
    <div v-if="model" class="flex flex-wrap items-center gap-2 text-sm">
      <span class="rounded-pill bg-accent-soft px-3 py-1.5 text-accent tabular-nums">
        {{ model.lat.toFixed(5) }}, {{ model.lng.toFixed(5) }}
      </span>
      <button
        v-if="!mapOpen"
        type="button"
        class="rounded-pill border border-line px-3 py-1.5 hover:border-accent"
        @click="openMap"
      >Xaritada tuzatiş</button>
      <button
        type="button"
        class="rounded-pill px-2 py-1.5 text-muted hover:text-accent"
        @click="model = null"
      >Öçiriş</button>
    </div>

    <div v-else class="flex flex-wrap gap-2 text-sm">
      <button
        type="button"
        :disabled="busy"
        class="rounded-pill border border-line px-3 py-1.5 hover:border-accent
               disabled:opacity-60"
        @click="fromGps"
      >{{ busy ? 'Aniqlanyapti…' : 'Men şu yerdaman' }}</button>
      <button
        v-if="!mapOpen"
        type="button"
        class="rounded-pill border border-line px-3 py-1.5 hover:border-accent"
        @click="openMap"
      >Xaritadan belgilaş</button>
    </div>

    <div v-show="mapOpen" class="mt-3">
      <div
        ref="mapEl"
        class="w-full rounded-soft overflow-hidden border border-line"
        style="height: 16rem"
      />
      <p class="mt-1 text-xs text-muted">Bosing yoki nuqtani sudrang.</p>
    </div>
  </div>
</template>
