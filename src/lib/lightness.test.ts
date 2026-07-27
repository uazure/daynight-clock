import { describe, expect, it } from 'vitest'
import {
  LIGHTNESS_ANCHORS,
  altitudeToLightness,
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
  it('produces a darker hsl string for a darker input', () => {
    expect(lightnessToFill(0)).toMatch(/^hsl\(/)
    expect(lightnessToFill(0)).not.toBe(lightnessToFill(1))
  })
})

describe('contrastInk', () => {
  it('inks dark on a bright dial and light on a dark dial', () => {
    expect(contrastInk(0.95)).toBe(contrastInk(0.8))
    expect(contrastInk(0.1)).toBe(contrastInk(0.2))
    expect(contrastInk(0.95)).not.toBe(contrastInk(0.1))
  })
})
