import { MINUTES_PER_SAMPLE, SAMPLES_PER_DAY, type SunEvents } from './sun';

/**
 * Which day-profile sample covers a given hour of the day. Relies on
 * `sampleDay`'s invariant that sample `i` is wall-clock minute `i` of the day
 * in the sampled zone — see the note on `sampleDay`.
 *
 * Deliberately not in `sun.ts` alongside that invariant: the pair has to agree
 * about what a sample index means, and keeping them in separate modules is what
 * makes the test composing them a cross-module one. That seam going untested is
 * how the ring-rotation bug survived nine reviews.
 *
 * The dial's appearance is not decided here — see `visual.ts`.
 */
export function sampleIndexForHour(hour: number): number {
  const index = Math.round((hour / 24) * SAMPLES_PER_DAY);
  return ((index % SAMPLES_PER_DAY) + SAMPLES_PER_DAY) % SAMPLES_PER_DAY;
}

/** Minutes in the day, as `sunEvents` counts them: `[0, MINUTES_PER_DAY]`. */
const MINUTES_PER_DAY = SAMPLES_PER_DAY * MINUTES_PER_SAMPLE;

/** One run of daylight, in minutes after the zone's midnight. */
export interface DaylightSpan {
  from: number;
  to: number;
}

/**
 * The day's daylight as spans the dial can draw, or `'full'` for a day with no
 * night at all, or `null` for a day with no daylight at all.
 *
 * `'full'` is called out rather than returned as the span `0…1440` because a
 * 360° arc cannot be drawn the same way as a partial one: `sectorPath`'s single
 * `A` command would start and end at the same point and paint nothing. The
 * caller has to reach for a circle instead, so the distinction belongs in the
 * type rather than in a radius comparison at the call site.
 *
 * WHY THIS IS NOT `[{ from: sunrise, to: sunset }]`: near the polar circles both
 * crossings can fall inside one calendar day **with the sunset first** — the sun
 * dips below the horizon just after midnight and climbs back before the next
 * one, so daylight wraps midnight and occupies both ends of the dial. Reykjavík
 * has 12 such days in 2026 (17 June: sunset 00:01, sunrise 02:56), Tromsø 8,
 * Svalbard 1. Handing that pair to `sectorPath` in order sweeps backwards and
 * fills the *night* instead, which is why this returns a list.
 */
export function daylightArcs({ sunrise, sunset, polar }: SunEvents): DaylightSpan[] | 'full' | null {
  if (polar !== null) {
    return polar === 'day' ? 'full' : null;
  }

  // With `polar` null at least one crossing exists. A missing one means the sun
  // was already on the lit side at that end of the day, so the span runs to the
  // day boundary. `sunEvents` starts its scan at sample 1 and cannot see a
  // crossing inside the last minute before midnight, so this is right to within
  // one minute — under one dial slice.
  if (sunrise === null) {
    return [{ from: 0, to: sunset ?? MINUTES_PER_DAY }];
  }
  if (sunset === null) {
    return [{ from: sunrise, to: MINUTES_PER_DAY }];
  }

  if (sunrise > sunset) {
    // Daylight wraps midnight: lit until `sunset` in the small hours, dark
    // through the middle of the day, lit again from `sunrise` to midnight.
    return [
      { from: 0, to: sunset },
      { from: sunrise, to: MINUTES_PER_DAY },
    ];
  }

  return [{ from: sunrise, to: sunset }];
}
