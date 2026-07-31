import { SAMPLES_PER_DAY } from './sun'

/**
 * Radii in viewBox units. The viewBox is `-100 -100 200 200`.
 *
 * The dial carries two numeral scales on one circle, and because the minute
 * hand turns 24 times faster than the hour hand they share angles: every
 * labelled minute sits at exactly the same angle as a labelled hour (minute
 * 10 with hour 16, minute 30 with hour 0, and so on). Angle therefore cannot
 * distinguish them and radius has to — hence hours *inside* the shaded face
 * and minutes on a band *outside* it, separated by the whole tick band and
 * the face outline. `dial.test.ts` pins that constraint.
 *
 * Putting the minute band outside the face has a second payoff: out there the
 * backdrop is the page, not the day/night gradient, so those numerals take
 * one static colour per theme instead of having to fight the shading.
 */
export const DIAL = {
  /** The shaded day/night face; everything below is measured against it. */
  face: 87,
  /**
   * Inner end of each hour tick; all of them run outward to `face`, so a
   * smaller radius means a longer, more emphatic tick. Three tiers: the
   * quarter-day anchors, the hours carrying a numeral, and the rest.
   */
  tickInner: {
    every1h: 80,
    every2h: 77,
    every6h: 73,
  },
  hourLabel: 64,
  /** Outside `face` — see the note above. */
  minuteLabel: 93.5,
  hourHand: 55,
  /**
   * Stops just inside where the quarter-day ticks end, rather than running out
   * to the face. The outer band is read off the hand's angle, not off its tip
   * touching anything, so the extra length only crowded the tick band.
   */
  minuteHand: 70,
  hub: 6,
} as const

/**
 * Type sizes in viewBox units; `dial.test.ts` checks these still fit.
 *
 * Everything here scales with the dial, so these are also the mobile sizes:
 * a 375px-wide viewport renders the dial at ~343px, i.e. 1.7px per unit. That
 * is what stops the minute numerals going smaller — they are already only
 * ~9px there — rather than any crowding on the band, which has room to spare.
 */
export const DIAL_TYPE = {
  hourLabel: 7,
  minuteLabel: 5.5,
} as const

/**
 * Every second hour carries a numeral. Every third was what the 2013 page
 * used; two is close enough spacing to read an hour off the dial without
 * counting ticks, and 12 numerals at this radius are nowhere near crowded.
 */
export const HOUR_LABEL_STEP = 2
/**
 * Minutes carrying a numeral on the outer band: 00, 05, 10 … 55. Twelve of
 * them still leave ~49 units of arc each out at `minuteLabel`, so the band is
 * nowhere near full, and every fifth minute is the granularity people
 * actually read a clock face at.
 */
export const MINUTE_LABEL_STEP = 5

/**
 * Which day-profile sample covers a given hour of the day. Relies on
 * `sampleDay`'s invariant that sample `i` is wall-clock minute `i` of the day
 * in the sampled zone — see the note on `sampleDay`.
 */
export function sampleIndexForHour(hour: number): number {
  const index = Math.round((hour / 24) * SAMPLES_PER_DAY)
  return ((index % SAMPLES_PER_DAY) + SAMPLES_PER_DAY) % SAMPLES_PER_DAY
}
