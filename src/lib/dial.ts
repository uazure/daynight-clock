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

/**
 * The mean lightness of the face over a stretch of hours centred on one — how
 * the two blocks of text at the hub choose which way round to draw their ink.
 *
 * A single sample is enough for a numeral out at `hourLabels.radius`, which
 * covers about an hour of arc. A block of text at the hub is not: it spans
 * hours either side of its own, and a flip decided by the one sample directly
 * behind its centre would swing on a backdrop most of its glyphs are not over.
 * The mean is that block's actual backdrop, near enough —
 * `VISUAL.hubText.flipSpanHours` carries the arithmetic for why the span is
 * 3.5 hours.
 *
 * Wraps, so hour 0 ± 3.5 is a real range rather than a clamped one — the
 * countdown's block is centred on midnight and half of it is yesterday. Relies
 * on the same invariant `sampleIndexForHour` does: sample `i` is wall-clock
 * minute `i` of the day in the sampled zone.
 */
export function meanLightnessAround(lightness: Float64Array, centreHour: number, spanHours: number): number {
  const first = sampleIndexForHour(centreHour - spanHours);
  const count = Math.round(((2 * spanHours) / 24) * SAMPLES_PER_DAY) + 1;

  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += lightness[(first + i) % SAMPLES_PER_DAY];
  }
  return total / count;
}
