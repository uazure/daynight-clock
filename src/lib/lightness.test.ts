import { describe, expect, it } from 'vitest'
import {
  LIGHTNESS_ANCHORS,
  altitudeToLightness,
  contrastHalo,
  contrastInk,
  lightnessToFill,
} from './lightness'

describe('altitudeToLightness', () => {
  it('returns exactly the anchor value at each anchor altitude', () => {
    for (const [altitude, lightness] of LIGHTNESS_ANCHORS) {
      expect(altitudeToLightness(altitude)).toBeCloseTo(lightness, 9)
    }
  })

  it('clamps above the brightest and below the darkest anchor', () => {
    const [darkestAlt, darkest] = LIGHTNESS_ANCHORS[0]
    const [brightestAlt, brightest] = LIGHTNESS_ANCHORS[LIGHTNESS_ANCHORS.length - 1]

    expect(altitudeToLightness(darkestAlt - 40)).toBeCloseTo(darkest, 9)
    expect(altitudeToLightness(brightestAlt + 40)).toBeCloseTo(brightest, 9)
    expect(altitudeToLightness(90)).toBeCloseTo(brightest, 9)
  })

  it('interpolates linearly between two anchors', () => {
    // Midway between -12 (0.32) and -6 (0.58).
    expect(altitudeToLightness(-9)).toBeCloseTo(0.45, 9)
  })

  it('never decreases as the sun climbs', () => {
    let previous = -Infinity
    for (let altitude = -90; altitude <= 90; altitude += 0.25) {
      const current = altitudeToLightness(altitude)
      expect(current).toBeGreaterThanOrEqual(previous)
      previous = current
    }
  })

  it('stays inside 0..1 across the whole domain', () => {
    for (let altitude = -90; altitude <= 90; altitude += 0.25) {
      const value = altitudeToLightness(altitude)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('is dark at night, mid at civil twilight, bright in daylight', () => {
    expect(altitudeToLightness(-25)).toBeLessThan(0.15)
    expect(altitudeToLightness(-3)).toBeGreaterThan(0.6)
    expect(altitudeToLightness(30)).toBe(1)
  })
})

describe('lightnessToFill', () => {
  it('produces exact hsl strings with correct hue, saturation, and band', () => {
    // 5%..96% band at hue 220, saturation 12%
    expect(lightnessToFill(0)).toBe('hsl(220 12% 5.0%)')
    expect(lightnessToFill(1)).toBe('hsl(220 12% 96.0%)')
  })

  it('fills darker for lower lightness (catches inverted band)', () => {
    const darkFill = lightnessToFill(0.2)
    const brightFill = lightnessToFill(0.8)
    // Extract the percentage from hsl() and compare numerically
    const darkPercent = parseFloat(darkFill.match(/\d+\.\d%/)![0])
    const brightPercent = parseFloat(brightFill.match(/\d+\.\d%/)![0])
    expect(darkPercent).toBeLessThan(brightPercent)
  })
})

describe('contrastInk', () => {
  it('inks dark on a bright dial and light on a dark dial', () => {
    expect(contrastInk(0.95)).toBe(contrastInk(0.8))
    expect(contrastInk(0.1)).toBe(contrastInk(0.2))
    expect(contrastInk(0.95)).not.toBe(contrastInk(0.1))
  })

  it('uses exact hsl strings pinned to the threshold logic', () => {
    // lightness > 0.5 → dark ink (12%), else light ink (92%)
    expect(contrastInk(0.7)).toBe('hsl(220 12% 12%)')
    expect(contrastInk(0.3)).toBe('hsl(220 12% 92%)')
  })
})

describe('contrastHalo', () => {
  /**
   * `contrastInk` flips at lightness 0.5, and either side of that flip its
   * ratio against the fill bottoms out near 3.5:1 — against 14:1 or better at
   * both ends of the ramp. Outlining the ink in the opposite tone rescues it:
   * the glyph then reads against its own halo rather than against whatever
   * the dial happens to be doing underneath.
   */
  it('is always the opposite tone to the ink it outlines', () => {
    for (const lightness of [0, 0.25, 0.49, 0.5, 0.51, 0.75, 1]) {
      expect(contrastHalo(lightness)).not.toBe(contrastInk(lightness))
    }
  })

  it('draws from the same two tones as the ink, never a third', () => {
    const inks = new Set([contrastInk(0), contrastInk(1)])
    expect(inks).toContain(contrastHalo(0))
    expect(inks).toContain(contrastHalo(1))
  })

  it('flips at the same threshold as the ink', () => {
    expect(contrastHalo(0.7)).toBe('hsl(220 12% 92%)')
    expect(contrastHalo(0.3)).toBe('hsl(220 12% 12%)')
  })
})
