import { getPosition } from 'suncalc'
import { altitudeToLightness } from './lightness'

/** One sample per minute of the day. */
export const SAMPLES_PER_DAY = 1440
export const MINUTES_PER_SAMPLE = (24 * 60) / SAMPLES_PER_DAY

export interface DayProfile {
  /** Sun altitude in degrees at each sample, index 0 = `dayStart`. */
  altitudes: Float64Array
  /** Dial lightness 0..1 at each sample. */
  lightness: Float64Array
}

/**
 * Samples the sun's altitude across the 24 hours starting at `dayStart`.
 *
 * Sampling altitude rather than solving for sunrise and sunset means polar day
 * and polar night need no special case: the profile simply comes out uniformly
 * positive or uniformly negative.
 */
export function sampleDay(dayStart: Date, lat: number, lon: number): DayProfile {
  const altitudes = new Float64Array(SAMPLES_PER_DAY)
  const lightness = new Float64Array(SAMPLES_PER_DAY)
  const stepMs = MINUTES_PER_SAMPLE * 60_000
  const startMs = dayStart.getTime()

  for (let i = 0; i < SAMPLES_PER_DAY; i += 1) {
    const altitude = getPosition(new Date(startMs + i * stepMs), lat, lon).altitude
    altitudes[i] = altitude
    lightness[i] = altitudeToLightness(altitude)
  }

  return { altitudes, lightness }
}

/** `YYYY-MM-DD` in local time — the memo key for a day's profile. */
export function localDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Local midnight for a `YYYY-MM-DD` key. Keyed by the string rather than by a
 * `Date` so that a memo over the day's profile can depend on the key alone.
 */
export function startOfLocalDay(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Fractional hours since local midnight, for placing the hands. */
export function hoursSinceLocalMidnight(now: Date): number {
  return (
    now.getHours() +
    now.getMinutes() / 60 +
    now.getSeconds() / 3600 +
    now.getMilliseconds() / 3_600_000
  )
}
