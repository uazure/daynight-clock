import { describe, expect, it } from 'vitest'
import {
  MINUTES_PER_SAMPLE,
  SAMPLES_PER_DAY,
  hoursSinceLocalMidnight,
  localDateKey,
  sampleDay,
  startOfLocalDay,
} from './sun'
import { altitudeToLightness } from './lightness'

/** Index of the sample covering a given UTC instant of a UTC-midnight-based day. */
const sampleAt = (hoursUtc: number) => (hoursUtc * 60) / MINUTES_PER_SAMPLE

describe('sampleDay', () => {
  it('covers the day at the declared resolution', () => {
    const profile = sampleDay(new Date('2026-06-21T00:00:00Z'), 50.45, 30.52)
    expect(profile.altitudes).toHaveLength(SAMPLES_PER_DAY)
    expect(profile.lightness).toHaveLength(SAMPLES_PER_DAY)
    expect((SAMPLES_PER_DAY * MINUTES_PER_SAMPLE) / 60).toBe(24)
  })

  it('matches known solar altitudes', () => {
    // Values produced by suncalc 2.0.1 itself; they anchor the wiring,
    // not the astronomy. Degrees, not radians.
    const kyivJune = sampleDay(new Date('2026-06-21T00:00:00Z'), 50.45, 30.52)
    expect(kyivJune.altitudes[sampleAt(9)]).toBeCloseTo(60.6058, 3)

    const kyivDec = sampleDay(new Date('2026-12-21T00:00:00Z'), 50.45, 30.52)
    expect(kyivDec.altitudes[sampleAt(9)]).toBeCloseTo(15.1439, 3)

    const quito = sampleDay(new Date('2026-03-20T00:00:00Z'), -0.18, -78.47)
    expect(quito.altitudes[sampleAt(17)]).toBeCloseTo(84.6757, 3)

    const sydney = sampleDay(new Date('2026-01-15T00:00:00Z'), -33.87, 151.21)
    expect(sydney.altitudes[sampleAt(2)]).toBeCloseTo(77.2407, 3)
  })

  it('reports polar day as an all-positive profile', () => {
    const { altitudes } = sampleDay(new Date('2026-06-21T00:00:00Z'), 78.22, 15.65)
    expect(Math.min(...altitudes)).toBeGreaterThan(0)
  })

  it('reports polar night as an all-negative profile', () => {
    const { altitudes } = sampleDay(new Date('2026-12-21T00:00:00Z'), 78.22, 15.65)
    expect(Math.max(...altitudes)).toBeLessThan(0)
  })

  it('derives lightness from altitude through the shared ramp', () => {
    const { altitudes, lightness } = sampleDay(
      new Date('2026-06-21T00:00:00Z'),
      50.45,
      30.52,
    )
    for (let i = 0; i < SAMPLES_PER_DAY; i += 37) {
      expect(lightness[i]).toBeCloseTo(altitudeToLightness(altitudes[i]), 12)
    }
  })

  it('gives a polar-night dial no daylight samples', () => {
    const { altitudes, lightness } = sampleDay(
      new Date('2026-12-21T00:00:00Z'),
      78.22,
      15.65,
    )
    // The sun stays below the civil-twilight boundary all day, so no part of
    // the dial reaches even the civil anchor's brightness. Expressed against
    // the anchor rather than a magic tolerance: the real brightest sample sits
    // at roughly 0.356, and a hand-picked bound near that is fragile.
    expect(Math.max(...altitudes)).toBeLessThan(-6)
    expect(Math.max(...lightness)).toBeLessThan(altitudeToLightness(-6))
  })
})

describe('startOfLocalDay', () => {
  it('turns a date key into local midnight', () => {
    const start = startOfLocalDay('2026-07-27')
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(6)
    expect(start.getDate()).toBe(27)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
  })

  it('round-trips with localDateKey', () => {
    const key = localDateKey(new Date(2026, 6, 27, 14, 33, 12, 500))
    expect(localDateKey(startOfLocalDay(key))).toBe(key)
  })
})

describe('localDateKey', () => {
  it('formats the local date zero-padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDateKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('hoursSinceLocalMidnight', () => {
  it('converts local wall time to fractional hours', () => {
    expect(hoursSinceLocalMidnight(new Date(2026, 6, 27, 0, 0, 0))).toBeCloseTo(0, 9)
    expect(hoursSinceLocalMidnight(new Date(2026, 6, 27, 6, 30, 0))).toBeCloseTo(6.5, 9)
    // Just before midnight, not `23, 59, 60` — a 60-second argument normalises
    // to the next day's midnight while the Date is being constructed, so the
    // function would correctly see 0, and no implementation could return 24.
    expect(
      hoursSinceLocalMidnight(new Date(2026, 6, 27, 23, 59, 59, 999)),
    ).toBeCloseTo(24, 4)
  })
})
