import { describe, it, expect } from 'vitest'
import { parseMapLink, isMapHost, MAP_HOSTS } from './maplink'

describe('parseMapLink', () => {
  it('reads name and pin from a Google place URL', () => {
    const r = parseMapLink('https://www.google.com/maps/place/Chorsu+Bazaar/@41.3264,69.2347,17z')
    expect(r.name).toBe('Chorsu Bazaar')
    expect(r.coords).toEqual({ lat: 41.3264, lng: 69.2347 })
    expect(r.needsResolving).toBe(false)
  })

  it('reads the name from a Yandex org URL', () => {
    const r = parseMapLink('https://yandex.com/maps/org/chorsu_bozori/73971814447/')
    expect(r.name).toBe('chorsu bozori')
  })

  it('keeps Yandex coordinates the right way round', () => {
    // ll is lng,lat. Swapping these puts every pin in Saudi Arabia, and
    // only the bounding box in schema.ts would catch it.
    const r = parseMapLink('https://yandex.uz/maps/?ll=69.2347%2C41.3264&z=17&text=Oloy%20bozori')
    expect(r.coords).toEqual({ lat: 41.3264, lng: 69.2347 })
    expect(r.name).toBe('Oloy bozori')
  })

  it('flags short share links as needing the server', () => {
    // These are what a phone's share button actually produces, so this
    // is the common case rather than the exotic one.
    for (const url of [
      'https://maps.app.goo.gl/AbCdEf123',
      'https://yandex.ru/maps/-/CDxxxxxx',
      'https://go.2gis.com/abc12',
    ]) {
      expect(parseMapLink(url).needsResolving).toBe(true)
    }
  })

  it('does not mistake a coordinate pair for a name', () => {
    const r = parseMapLink('https://yandex.uz/maps/?ll=69.2347%2C41.3264&text=41.3264%2C69.2347')
    expect(r.name).toBeNull()
  })

  it('still reads a bare coordinate pair that is not a URL', () => {
    expect(parseMapLink('41.3264, 69.2347').coords).toEqual({ lat: 41.3264, lng: 69.2347 })
  })

  it('returns nothing rather than guessing', () => {
    expect(parseMapLink('')).toMatchObject({ coords: null, name: null })
    expect(parseMapLink('Çorsu bozori')).toMatchObject({ coords: null, name: null })
  })
})

describe('isMapHost', () => {
  it('accepts every host the resolver is allowed to follow', () => {
    for (const h of MAP_HOSTS) expect(isMapHost(`https://${h}/maps`)).toBe(true)
  })

  it('rejects anything else, because this list is the SSRF allowlist', () => {
    for (const url of [
      'https://evil.example/maps',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:3000/api/auth/me',
      'https://yandex.com.evil.example/maps',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(isMapHost(url)).toBe(false)
    }
  })
})
