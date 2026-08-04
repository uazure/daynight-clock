import { SAMPLES_PER_DAY } from './sun';

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
