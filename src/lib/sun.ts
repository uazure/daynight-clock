import { getPosition } from 'suncalc';
import { altitudeToLightness, HORIZON_DEG } from './lightness';
import { instantForZoneWallClockWith, offsetTimelineForDay } from './time';

/** One sample per minute of the day. */
export const SAMPLES_PER_DAY = 1440;
export const MINUTES_PER_SAMPLE = (24 * 60) / SAMPLES_PER_DAY;

export interface DayProfile {
  /** Sun altitude in degrees at each sample, index 0 = the zone's midnight. */
  altitudes: Float64Array;
  /** Dial lightness 0..1 at each sample. */
  lightness: Float64Array;
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
 *
 * The offsets those 1440 inversions need are resolved once, into an
 * `OffsetTimeline`, rather than asked of `Intl` per sample. That is where nearly
 * all of this function's cost used to sit — 2880 `formatToParts` calls against
 * 1440 cheap `getPosition` calls, ~15 ms a profile, which a knob scrubbing
 * through dates cannot afford. The invariant above is untouched by it: see
 * `instantForZoneWallClockWith` for why, and for the test that proves it.
 */
export function sampleDay(dateKey: string, lat: number, lon: number, timeZone: string): DayProfile {
  const altitudes = new Float64Array(SAMPLES_PER_DAY);
  const lightness = new Float64Array(SAMPLES_PER_DAY);
  const offsets = offsetTimelineForDay(dateKey, timeZone);

  for (let i = 0; i < SAMPLES_PER_DAY; i += 1) {
    const minutes = i * MINUTES_PER_SAMPLE;
    const at = instantForZoneWallClockWith(offsets, dateKey, Math.floor(minutes / 60), minutes % 60, timeZone);
    const altitude = getPosition(at, lat, lon).altitude;
    altitudes[i] = altitude;
    lightness[i] = altitudeToLightness(altitude);
  }

  return { altitudes, lightness };
}

export interface SunEvents {
  /**
   * Minutes after the zone's midnight, fractional. `null` when the sun does
   * not make that crossing during the day — polar day and polar night, but
   * also the single days that begin or end them, where one crossing happens
   * and the other does not.
   */
  sunrise: number | null;
  sunset: number | null;
  /** Set only when neither crossing happens, to say which side it stayed on. */
  polar: 'day' | 'night' | null;
}

/**
 * Where the day's profile crosses `HORIZON_DEG`, read straight off the samples
 * `sampleDay` already produced rather than solved for independently — so the
 * printed time and the ring's own change of shade cannot disagree.
 *
 * The crossing is interpolated linearly between the two samples that straddle
 * it. Over one minute the sun's altitude is near enough linear that this puts
 * the result within a second or two of the true crossing, against the ±30 s a
 * bare sample index would give.
 *
 * Consistent with `sampleDay`'s contract, "the day" is the zone's own
 * midnight-to-midnight: sample 0 is 00:00 and sample 1439 is 23:59, so a
 * crossing inside that last minute before midnight is not seen. It costs at
 * most one minute at the very end of the day and keeps this function a pure
 * read of one day's profile.
 */
export function sunEvents(altitudes: Float64Array): SunEvents {
  let sunrise: number | null = null;
  let sunset: number | null = null;

  for (let i = 1; i < altitudes.length; i += 1) {
    const previous = altitudes[i - 1];
    const current = altitudes[i];
    const rising = previous <= HORIZON_DEG && current > HORIZON_DEG;
    const setting = previous > HORIZON_DEG && current <= HORIZON_DEG;
    if (!rising && !setting) {
      continue;
    }

    // Fraction of the way from sample i-1 to sample i at which the ramp
    // between the two altitudes reaches the horizon. The guard above
    // guarantees they lie on opposite sides of it, so the divisor is non-zero.
    const t = (HORIZON_DEG - previous) / (current - previous);
    const minute = (i - 1 + t) * MINUTES_PER_SAMPLE;

    // First crossing of each kind wins: a day holds one of each anywhere the
    // dial is legible, and taking the first keeps the pathological cases
    // (a grazing sun near the polar circles) deterministic rather than
    // reporting whichever crossing happened to come last.
    if (rising) {
      sunrise ??= minute;
    } else {
      sunset ??= minute;
    }
  }

  if (sunrise === null && sunset === null) {
    return { sunrise, sunset, polar: altitudes[0] > HORIZON_DEG ? 'day' : 'night' };
  }

  return { sunrise, sunset, polar: null };
}
