<script setup lang="ts">
/**
 * Two ways to say where a place is: "here", or by tapping a map.
 *
 * The third and most common way — pasting a shared map link — lives on
 * the page above, because a link now fills the name as well as the pin
 * and this component has no business setting a name.
 */
const model = defineModel<{ lat: number; lng: number } | null>({ default: null })

const config = useRuntimeConfig().public
const asset = useAssetUrl()

const mapEl = ref<HTMLElement | null>(null)
const mapState = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')
const geoState = ref<'idle' | 'asking' | 'denied' | 'far'>('idle')

/** Tashkent's bounding box — the same one the schema enforces. */
const IN_TASHKENT = (c: { lat: number; lng: number }) =>
  c.lat >= 41.15 && c.lat <= 41.45 && c.lng >= 69.10 && c.lng <= 69.55

let marker: { setLngLat: (c: [number, number]) => void } | null = null
let map: { flyTo: (o: object) => void } | null = null

function set(c: { lat: number; lng: number }) {
  model.value = c
}

/**
 * Keep the map in step with the pin, wherever the pin came from.
 *
 * The page above can set it from a pasted link while this map is
 * already open, and a marker left at the old spot would quietly
 * contradict the coordinates printed underneath it.
 */
watch(model, (c) => {
  if (!c) return
  marker?.setLngLat([c.lng, c.lat])
  map?.flyTo({ center: [c.lng, c.lat], zoom: 16 })
})

function fromGps() {
  if (!navigator.geolocation) return
  geoState.value = 'asking'
  navigator.geolocation.getCurrentPosition(
    (p) => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude }
      // Someone adding a Tashkent shop from another country is using the
      // wrong button, and a pin in Berlin helps nobody.
      if (!IN_TASHKENT(c)) { geoState.value = 'far'; return }
      geoState.value = 'idle'
      set(c)
    },
    () => { geoState.value = 'denied' },
    { enableHighAccuracy: true, timeout: 10_000 },
  )
}

/**
 * The same lazy-load discipline as MapView: MapLibre is ~200KB and most
 * submissions never need it, because the pasted link already answered
 * the question.
 */
async function showMap() {
  if (mapState.value !== 'idle') return
  mapState.value = 'loading'
  try {
    const [{ default: maplibregl }, { Protocol }, { layers, namedFlavor }] = await Promise.all([
      import('maplibre-gl'),
      import('pmtiles'),
      import('@protomaps/basemaps'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])

    maplibregl.addProtocol('pmtiles', new Protocol().tile)
    await nextTick()
    if (!mapEl.value) throw new Error('kontejner topilmadi')

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

    // Draggable, so a pin dropped near enough can be nudged onto the
    // actual doorway rather than re-tapped until it lands.
    const mk = new maplibregl.Marker({ color: '#0B6D5B', draggable: true })
      .setLngLat([start.lng, start.lat])
      .addTo(m)
    marker = mk as never
    mk.on('dragend', () => {
      const { lat, lng } = mk.getLngLat()
      model.value = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) }
    })

    m.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
      const c = { lat: +e.lngLat.lat.toFixed(6), lng: +e.lngLat.lng.toFixed(6) }
      model.value = c
      mk.setLngLat([c.lng, c.lat])
    })

    m.on('error', () => { if (mapState.value !== 'ready') mapState.value = 'failed' })
    m.on('load', () => { mapState.value = 'ready' })
  } catch {
    mapState.value = 'failed'
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Standing in the doorway. -->
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        class="rounded-pill border border-line px-3 py-1.5 hover:border-accent
               disabled:opacity-60"
        :disabled="geoState === 'asking'"
        @click="fromGps"
      >{{ geoState === 'asking' ? 'Aniqlanyapti…' : 'Men şu yerdaman' }}</button>

      <button
        v-if="mapState === 'idle'"
        type="button"
        class="rounded-pill border border-line px-3 py-1.5 hover:border-accent"
        @click="showMap"
      >Xaritadan belgilaş</button>

      <span v-if="geoState === 'denied'" class="text-muted">
        Joylaşuvga ruxsat berilmadi.
      </span>
      <span v-else-if="geoState === 'far'" class="text-muted">
        Siz Toşkentda emassiz — xaritadan belgilang.
      </span>
    </div>

    <!-- Tap it. -->
    <div v-show="mapState === 'loading' || mapState === 'ready'">
      <div
        ref="mapEl"
        class="w-full rounded-soft overflow-hidden border border-line"
        style="height: 18rem"
      />
      <p class="mt-1 text-xs text-muted">
        Xaritani bosing yoki nuqtani sudrab joyiga qöying.
      </p>
    </div>

    <p v-if="mapState === 'loading'" class="text-sm text-muted">Xarita yuklanmoqda…</p>
    <p v-if="mapState === 'failed'" class="text-sm text-muted">
      Xarita yuklanmadi — havola joylaştiring yoki böş qoldiring, biz topamiz.
    </p>

    <p
      v-if="model"
      class="rounded-soft bg-accent-soft px-3 py-2 text-sm text-accent tabular-nums"
    >
      Nuqta belgilandi: {{ model.lat.toFixed(5) }}, {{ model.lng.toFixed(5) }}
    </p>
  </div>
</template>
