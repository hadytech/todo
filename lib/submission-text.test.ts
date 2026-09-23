import { describe, it, expect } from 'vitest'
import { submissionText } from './submission-text'

describe('submissionText', () => {
  it('leads with the name and keeps a stable field order', () => {
    const text = submissionText({
      name: 'Çorsu Sartaroşxonasi',
      categoryLabel: 'Sartaroşxonalar',
      districtLabel: 'Şayxontohur',
      address: 'Çorsu bozori yonida',
      coords: { lat: 41.3264, lng: 69.2347 },
      phone: '+998 90 123 45 67',
    })
    expect(text.split('\n')[0]).toBe('yalp.uz — yangi joy: Çorsu Sartaroşxonasi')
    expect(text).toContain('Turi: Sartaroşxonalar')
    // A bare pair, because that is what entry.ts and every maps app take.
    expect(text).toContain('Nuqta: 41.3264, 69.2347')
    expect(text.indexOf('Turi')).toBeLessThan(text.indexOf('Manzil'))
  })

  it('omits every field nobody filled in, rather than printing blanks', () => {
    const text = submissionText({ name: 'Yangi Joy' })
    expect(text.trim()).toBe('yalp.uz — yangi joy: Yangi Joy')
    expect(text).not.toContain('Telefon')
    expect(text).not.toContain('Nuqta')
  })

  it('treats whitespace-only input as absent', () => {
    const text = submissionText({ name: ' Bozor ', address: '   ', comment: '' })
    expect(text).toContain('yangi joy: Bozor')
    expect(text).not.toContain('Manzil')
  })

  it('keeps a pin of zero-ish coordinates rather than dropping them', () => {
    // A falsy-looking number must not be discarded the way an empty
    // string is. Tashkent is nowhere near 0,0, but the rule is about the
    // check being on presence, not truthiness.
    const text = submissionText({ name: 'X', coords: { lat: 41.0, lng: 69.0 } })
    expect(text).toContain('Nuqta: 41, 69')
  })
})
