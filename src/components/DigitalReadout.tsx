import { memo } from 'react';
import { formatClockTime, formatDialDate } from '../lib/time';
import { VISUAL } from '../lib/visual';

const { digital, hubText } = VISUAL;

interface Props {
  /** The real instant, for the date. Never a simulated one — see below. */
  now: Date;
  /** The zone all three lines are read in, threaded down from `App`. */
  timeZone: string;
  /** Already derived from `now` and `timeZone` by `Clock`, so this does not derive it twice. */
  minuteOfDay: number;
  hour12: boolean;
}

/**
 * The clock, today's date and the countdown, stacked below the hub.
 *
 * The face already tells the time; what it cannot do is resolve 10:42 from
 * 10:47, and it cannot say which day it is at all. The date matters more than
 * it looks: the dial runs on the *shown place's* zone, so picking Tokyo from
 * Prague legitimately puts tomorrow at the hub, and nothing else on screen
 * says so.
 *
 * **Below the hub, because that is the half the hands leave alone.** Someone
 * glancing at a clock does it during the day, and through the day both hands
 * are in the upper half, where they also cross the hour numerals — so a block
 * up there competes with two things at once and reads as clutter. Down here
 * the hour hand only passes from about 19:30 to 04:30. `VISUAL.digital` has
 * the arithmetic and the reason all three lines share one stack.
 *
 * **The countdown under it is `MarkerReadout`'s**, not this component's, even
 * though the three lines read as one stack. That component draws the countdown
 * in both of the forms it takes and reads `markers.readout` for both, so the
 * countdown's appearance has one owner and one block of config; drawing the
 * compact line here instead is what once left `markers.readout` unreachable
 * whenever the clock was on. What this component owes it is room — `time` and
 * `date` are what decide whether the caption still fits underneath.
 *
 * **The ink is fixed, not flipped**: light over a dark outline, always. This
 * block sits over the midnight fan, so a light fill is right on every day that
 * is not a polar one, and the black outline is what keeps it legible on the
 * exception and wherever a hand passes beneath it.
 *
 * Drawn after the hands, so the digits sit on top of one rather than being cut
 * in half by it — at 12 units this is the only text on the face heavy enough
 * to win that overlap.
 *
 * Invisible to assistive technology, the `<svg>` being `role="img"`. `Clock`
 * puts all of it into the dial's accessible name, which is the only route text
 * inside it has.
 *
 * **Nothing here may come from the simulated date** (AGENTS.md rule 16). It is
 * handed `now` and derives the date from that, so a scrubbed year knob shades
 * the face for another day while the hub keeps saying today — which is the
 * pair working as designed, with the `Shading for …` notice above the dial
 * naming the day being simulated.
 */
export const DigitalReadout = memo(function DigitalReadout({ now, timeZone, minuteOfDay, hour12 }: Props) {
  const { text, meridiem } = formatClockTime(minuteOfDay, hour12);
  const date = formatDialDate(now, timeZone);

  return (
    <g stroke={hubText.dark} strokeLinejoin="round" paintOrder="stroke" textAnchor="middle">
      <text
        y={digital.time.y}
        fill={hubText.light}
        fontSize={digital.time.size}
        fontWeight={digital.time.weight}
        strokeWidth={digital.time.haloWidth}
      >
        {text}
        {/*
          A `dx` and not a typed space: SVG collapses leading whitespace in a
          `<tspan>` by default, so the gap has to be a measurement. It is part
          of the advance, so `text-anchor: middle` still centres the pair.
        */}
        {meridiem !== null && (
          <tspan fontSize={digital.meridiem.size} dx={digital.meridiem.gap}>
            {meridiem}
          </tspan>
        )}
      </text>
      <text
        y={digital.date.y}
        fill={hubText.light}
        fontSize={digital.date.size}
        fontWeight={digital.date.weight}
        strokeWidth={digital.date.haloWidth}
      >
        {date}
      </text>
    </g>
  );
});
