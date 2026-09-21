import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIGHT, DARK, MINT, contrast } from './brand'

/** Text needs 4.5:1; a border only has to be perceptible. */
const AA_TEXT = 4.5
const UI = 1.2

for (const [themeName, t] of [['light', LIGHT], ['dark', DARK]] as const) {
  describe(`palette — ${themeName}`, () => {
    for (const ground of ['canvas', 'surface'] as const) {
      it(`ink reads on ${ground}`, () => {
        expect(contrast(t.ink, t[ground])).toBeGreaterThanOrEqual(AA_TEXT)
      })
      it(`muted reads on ${ground}`, () => {
        // Muted is used for real content — addresses, categories — not
        // decoration, so it is held to the same bar as any other text.
        expect(contrast(t.muted, t[ground])).toBeGreaterThanOrEqual(AA_TEXT)
      })
      it(`accent reads on ${ground}`, () => {
        expect(contrast(t.accent, t[ground])).toBeGreaterThanOrEqual(AA_TEXT)
      })
    }

    it('button label reads on the accent fill', () => {
      expect(contrast(t.accentInk, t.accent)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('accent reads on its own soft tint (the open/closed pill)', () => {
      expect(contrast(t.accent, t.accentSoft)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('borders are perceptible against the surface', () => {
      expect(contrast(t.line, t.surface)).toBeGreaterThanOrEqual(UI)
    })
  })
}

describe('stylesheet matches the brand', () => {
  const css = readFileSync(join(process.cwd(), 'app/assets/css/main.css'), 'utf8')

  /** Reads the tokens out of one CSS block. */
  function tokensIn(marker: string): Record<string, string> {
    const start = css.indexOf(marker)
    expect(start, `block not found: ${marker}`).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('}', start))
    return Object.fromEntries(
      [...block.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1]!, m[2]!.toUpperCase()]),
    )
  }

  const EXPECTED = {
    canvas: 'canvas', surface: 'surface', raised: 'raised',
    ink: 'ink', muted: 'muted', line: 'line',
    accent: 'accent', 'accent-ink': 'accentInk', 'accent-soft': 'accentSoft',
  } as const

  it('light tokens match lib/brand.ts', () => {
    const found = tokensIn('/* LIGHT-TOKENS */')
    for (const [cssName, key] of Object.entries(EXPECTED)) {
      expect(found[cssName], cssName).toBe(LIGHT[key as keyof typeof LIGHT].toUpperCase())
    }
  })

  it('dark tokens match lib/brand.ts', () => {
    const found = tokensIn('/* DARK-TOKENS */')
    for (const [cssName, key] of Object.entries(EXPECTED)) {
      expect(found[cssName], cssName).toBe(DARK[key as keyof typeof DARK].toUpperCase())
    }
  })
})

describe('MINT scale', () => {
  it('runs light to dark without a reversal', () => {
    const steps = Object.values(MINT)
    for (let i = 1; i < steps.length; i++) {
      expect(contrast(steps[i]!, '#FFFFFF')).toBeGreaterThan(contrast(steps[i - 1]!, '#FFFFFF'))
    }
  })
})
