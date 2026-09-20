import { describe, it, expect } from 'vitest'
import { parseCoords } from './coords'

describe('parseCoords', () => {
  it('reads a bare "lat, lng" pair', () => {
    expect(parseCoords('41.3264, 69.2347')).toEqual({ lat: 41.3264, lng: 69.2347 })
    expect(parseCoords('41.3264,69.2347')).toEqual({ lat: 41.3264, lng: 69.2347 })
  })

  it('reads a Google Maps URL', () => {
    expect(parseCoords('https://www.google.com/maps/@41.3264,69.2347,17z'))
      .toEqual({ lat: 41.3264, lng: 69.2347 })
  })

  it('reads a Yandex Maps URL, which orders ll as lng,lat', () => {
    // The trap: Yandex is reversed. Getting this wrong puts every pin in
    // the wrong hemisphere, and the Tashkent bounding box in schema.ts is
    // the only thing that would catch it.
    expect(parseCoords('https://yandex.uz/maps/?ll=69.2347%2C41.3264&z=17'))
      .toEqual({ lat: 41.3264, lng: 69.2347 })
  })

  it('rejects input it cannot parse rather than guessing', () => {
    expect(parseCoords('')).toBeNull()
    expect(parseCoords('Çorsu bozori')).toBeNull()
    expect(parseCoords('41, 69')).toBeNull()
  })
})
