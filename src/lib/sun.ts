import { getPosition } from 'suncalc'
import { altitudeToLightness } from './lightness'
import { instantForZoneWallClock } from './time'

/** One sample per minute of the day. */
export const SAMPLES_PER_DAY = 1440
export const MINUTES_PER_SAMPLE = (24 * 60) / SAMPLES_PER_DAY

export interface DayProfile {
  /** Sun altitude in degrees at each sample, index 0 = the zone's midnight. */
  altitudes: Float64Array
  /** Dial lightness 0..1 at each sample. */
  lightness: Float64Array
}

/**
 * Samples the sun's altitude across the day `dateKey` (`YYYY-MM-DD`) as it
 * runs in `timeZone`, at the given coordinates.
 *
 * Sampling altitude rather than solving for sunrise and sunset means polar day
 * and polar night need no special case: the profile simply comes out uniformly
 * positive or uniformly negative.
 *
 * INVARIANT: sample `i` is **wall-clock minute `i` of the day in `timeZone`**
 * — index 300 is that zone's 05:00 whatever the UTC offset does that day.
 * `dial.ts`'s `sampleIndexForHour` maps a wall-clock hour straight onto this
 * index, so the two only agree if each sample instant is resolved from zone
 * wall-clock components, as below. Sample times must NOT be derived by adding
 * elapsed milliseconds to a start instant: on a DST transition day the offset
 * changes mid-day, elapsed minute `i` stops being wall-clock minute `i`, and
 * the whole ring ends up rotated an hour away from the hands (and the last
 * wall-clock hour of a fall-back day is never sampled at all).
 */
export function sampleDay(
  dateKey: string,
  lat: number,
  lon: number,
  timeZone: string,
): DayProfile {
  const altitudes = new Float64Array(SAMPLES_PER_DAY)
  const lightness = new Float64Array(SAMPLES_PER_DAY)

  for (let i = 0; i < SAMPLES_PER_DAY; i += 1) {
    const minutes = i * MINUTES_PER_SAMPLE
    const at = instantForZoneWallClock(dateKey, Math.floor(minutes / 60), minutes % 60, timeZone)
    const altitude = getPosition(at, lat, lon).altitude
    altitudes[i] = altitude
    lightness[i] = altitudeToLightness(altitude)
  }

  return { altitudes, lightness }
}
