import { describe, expect, it } from 'vitest'
import { getPosition, getTimes } from 'suncalc'
import {
  MINUTES_PER_SAMPLE,
  SAMPLES_PER_DAY,
  hoursSinceLocalMidnight,
  localDateKey,
  sampleDay,
  startOfLocalDay,
} from './sun'
import { sampleIndexForHour } from './dial'
import { altitudeToLightness } from './lightness'

/**
 * Index of the sample covering a given **local wall-clock** hour. `sampleDay`
 * guarantees sample `i` is wall-clock minute `i` of the local day, so every
 * fixture below is expressed in the test run's zone, pinned to `Europe/Prague`
 * in `vite.config.ts`. Days are built from local date components for the same
 * reason: an absolute instant would land on a different wall clock elsewhere.
 */
const sampleAt = (localHour: number) => (localHour * 60) / MINUTES_PER_SAMPLE

/** The refraction-corrected horizon — sunrise and sunset. */
const HORIZON_DEG = -0.833

describe('sampleDay', () => {
  it('covers the day at the declared resolution', () => {
    const profile = sampleDay(new Date(2026, 5, 21), 50.45, 30.52)
    expect(profile.altitudes).toHaveLength(SAMPLES_PER_DAY)
    expect(profile.lightness).toHaveLength(SAMPLES_PER_DAY)
    expect((SAMPLES_PER_DAY * MINUTES_PER_SAMPLE) / 60).toBe(24)
  })

  it('places sample i at wall-clock minute i of the local day', () => {
    // The invariant `sampleIndexForHour` depends on, asserted directly and on a
    // DST transition day, where indexing by elapsed time would drift an hour.
    for (const day of [new Date(2026, 6, 27), new Date(2026, 2, 29), new Date(2026, 9, 25)]) {
      const { altitudes } = sampleDay(day, 50.09, 14.42)
      for (const minute of [0, 1, 137, 500, 1439]) {
        const wallClock = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          0,
          minute,
        )
        expect(altitudes[minute]).toBeCloseTo(
          getPosition(wallClock, 50.09, 14.42).altitude,
          12,
        )
      }
    }
  })

  it('matches known solar altitudes', () => {
    // Values produced by suncalc 2.0.1 itself, at the given local wall-clock
    // hour of the given local day; they anchor the wiring, not the astronomy.
    // Degrees, not radians.
    const kyivJune = sampleDay(new Date(2026, 5, 21), 50.45, 30.52)
    expect(kyivJune.altitudes[sampleAt(9)]).toBeCloseTo(46.0967, 3)

    const kyivDec = sampleDay(new Date(2026, 11, 21), 50.45, 30.52)
    expect(kyivDec.altitudes[sampleAt(9)]).toBeCloseTo(11.871, 3)

    const quito = sampleDay(new Date(2026, 2, 20), -0.18, -78.47)
    expect(quito.altitudes[sampleAt(17)]).toBeCloseTo(69.6808, 3)

    const sydney = sampleDay(new Date(2026, 0, 15), -33.87, 151.21)
    expect(sydney.altitudes[sampleAt(2)]).toBeCloseTo(70.9285, 3)
  })

  it('reports polar day as an all-positive profile', () => {
    const { altitudes } = sampleDay(new Date(2026, 5, 21), 78.22, 15.65)
    expect(Math.min(...altitudes)).toBeGreaterThan(0)
  })

  it('reports polar night as an all-negative profile', () => {
    const { altitudes } = sampleDay(new Date(2026, 11, 21), 78.22, 15.65)
    expect(Math.max(...altitudes)).toBeLessThan(0)
  })

  it('derives lightness from altitude through the shared ramp', () => {
    const { altitudes, lightness } = sampleDay(new Date(2026, 5, 21), 50.45, 30.52)
    for (let i = 0; i < SAMPLES_PER_DAY; i += 37) {
      expect(lightness[i]).toBeCloseTo(altitudeToLightness(altitudes[i]), 12)
    }
  })

  it('gives a polar-night dial no daylight samples', () => {
    const { altitudes, lightness } = sampleDay(new Date(2026, 11, 21), 78.22, 15.65)
    // The sun stays below the civil-twilight boundary all day, so no part of
    // the dial reaches even the civil anchor's brightness. Expressed against
    // the anchor rather than a magic tolerance: the real brightest sample sits
    // at roughly 0.356, and a hand-picked bound near that is fragile.
    expect(Math.max(...altitudes)).toBeLessThan(-6)
    expect(Math.max(...lightness)).toBeLessThan(altitudeToLightness(-6))
  })
})

/**
 * The pair no other test composes: `sampleDay` produces the profile, and the
 * dial reads it back through `sampleIndexForHour`. If the two disagree about
 * what a sample index means, the whole ring is rotated away from the hands —
 * which is exactly what happened while samples were indexed by elapsed time,
 * on the two days a year when the UTC offset changes mid-day.
 */
describe('sampleDay composed with sampleIndexForHour', () => {
  const PRAGUE = { lat: 50.09, lon: 14.42 }
  /**
   * The sampled crossing and suncalc's own `getTimes` disagree by a couple of
   * minutes on every day, transition or not — they use different solar models.
   * Wide enough to absorb that, far narrower than the hour this test exists to
   * catch.
   */
  const TOLERANCE_MIN = 10

  /** Minute of the local day at which the dial's shading crosses the horizon. */
  function dialCrossing(day: Date, direction: 'rise' | 'set'): number {
    const { altitudes } = sampleDay(day, PRAGUE.lat, PRAGUE.lon)
    for (let minute = 1; minute < 24 * 60; minute += 1) {
      const previous = altitudes[sampleIndexForHour((minute - 1) / 60)]
      const current = altitudes[sampleIndexForHour(minute / 60)]
      const crossed =
        direction === 'rise'
          ? previous < HORIZON_DEG && current >= HORIZON_DEG
          : previous >= HORIZON_DEG && current < HORIZON_DEG
      if (crossed) return minute
    }
    throw new Error(`no ${direction} crossing found`)
  }

  /** Minute of the local day of suncalc's own sunrise/sunset for that day. */
  function trueCrossing(day: Date, direction: 'rise' | 'set'): number {
    const localNoon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12)
    const times = getTimes(localNoon, PRAGUE.lat, PRAGUE.lon)
    const event = direction === 'rise' ? times.sunrise : times.sunset
    // Typed nullable because the sun need not cross the horizon at all; Prague
    // in March, July and October is not one of those places.
    if (event === null) throw new Error(`suncalc reports no ${direction} for this day`)
    return event.getHours() * 60 + event.getMinutes()
  }

  const days: Array<[string, Date]> = [
    ['spring forward', new Date(2026, 2, 29)],
    ['fall back', new Date(2026, 9, 25)],
    ['no transition', new Date(2026, 6, 27)],
  ]

  for (const [name, day] of days) {
    it(`puts the shading boundary at the true local sunrise and sunset (${name})`, () => {
      for (const direction of ['rise', 'set'] as const) {
        expect(
          Math.abs(dialCrossing(day, direction) - trueCrossing(day, direction)),
        ).toBeLessThanOrEqual(TOLERANCE_MIN)
      }
    })
  }

  it('samples the last wall-clock hour of a fall-back day', () => {
    // A 25-hour absolute day sampled by elapsed minutes ran out before 23:00
    // local, leaving the final hour of the ring holding the wrong altitude.
    const day = new Date(2026, 9, 25)
    const { altitudes } = sampleDay(day, PRAGUE.lat, PRAGUE.lon)
    const lateEvening = new Date(2026, 9, 25, 23, 30)
    expect(altitudes[sampleIndexForHour(23.5)]).toBeCloseTo(
      getPosition(lateEvening, PRAGUE.lat, PRAGUE.lon).altitude,
      12,
    )
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
