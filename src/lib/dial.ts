import { SAMPLES_PER_DAY } from './sun'

/**
 * Radii in viewBox units. The viewBox is `-100 -100 200 200`, so the face has
 * to stay under 100 to leave room for its own stroke.
 */
export const DIAL = {
  face: 92,
  hourTickInner: 84,
  hourTickInnerStrong: 77,
  hourLabel: 68,
  hourHand: 58,
  minuteHand: 74,
  hub: 6,
} as const

/**
 * Which day-profile sample covers a given hour of the local day. Relies on
 * `sampleDay`'s invariant that sample `i` is wall-clock minute `i` of the local
 * day — see the note on `sampleDay`.
 */
export function sampleIndexForHour(hour: number): number {
  const index = Math.round((hour / 24) * SAMPLES_PER_DAY)
  return ((index % SAMPLES_PER_DAY) + SAMPLES_PER_DAY) % SAMPLES_PER_DAY
}
