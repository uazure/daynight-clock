import { getPosition } from 'suncalc'
import { altitudeToLightness } from './lightness'

/** One sample per minute of the day. */
export const SAMPLES_PER_DAY = 1440
export const MINUTES_PER_SAMPLE = (24 * 60) / SAMPLES_PER_DAY

export interface DayProfile {
  /** Sun altitude in degrees at each sample, index 0 = local midnight. */
  altitudes: Float64Array
  /** Dial lightness 0..1 at each sample. */
  lightness: Float64Array
}

/**
 * Samples the sun's altitude across the local day that begins at `dayStart`.
 *
 * Sampling altitude rather than solving for sunrise and sunset means polar day
 * and polar night need no special case: the profile simply comes out uniformly
 * positive or uniformly negative.
 *
 * INVARIANT: sample `i` is **wall-clock minute `i` of the local day** — index
 * 300 is local 05:00 whatever the UTC offset does that day. `dial.ts`'s
 * `sampleIndexForHour` maps a wall-clock hour straight onto this index, so the
 * two only agree if sample times are built from local date components, as
 * below. Sample times must NOT be derived by adding elapsed milliseconds to a
 * start instant: on a DST transition day the offset changes mid-day, elapsed
 * minute `i` stops being wall-clock minute `i`, and the whole ring ends up
 * rotated an hour away from the hands (and the last wall-clock hour of a
 * fall-back day is never sampled at all).
 */
export function sampleDay(dayStart: Date, lat: number, lon: number): DayProfile {
  const altitudes = new Float64Array(SAMPLES_PER_DAY)
  const lightness = new Float64Array(SAMPLES_PER_DAY)
  const year = dayStart.getFullYear()
  const month = dayStart.getMonth()
  const day = dayStart.getDate()

  for (let i = 0; i < SAMPLES_PER_DAY; i += 1) {
    const at = new Date(year, month, day, 0, i * MINUTES_PER_SAMPLE)
    const altitude = getPosition(at, lat, lon).altitude
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
