import { memo, useMemo } from 'react';
import { meanLightnessAround } from '../lib/dial';
import { hubInk } from '../lib/lightness';
import { type NextBoundary, readoutLines } from '../lib/markers';
import { VISUAL } from '../lib/visual';

const { readout } = VISUAL.markers;
const { dark, flipSpanHours } = VISUAL.hubText;

interface Props {
  next: NextBoundary;
  /** The day's shading, for choosing which way round to draw the full form's ink. */
  lightness: Float64Array;
  /** Whether times are written on a 12-hour clock. */
  hour12: boolean;
  /**
   * Whether the digital clock is above this, in which case the countdown is
   * one grey caption line rather than two — see `readout.compact`.
   */
  compact: boolean;
}

/**
 * The countdown at the hub: what happens next, and how long until it does.
 *
 * **The only thing that draws it, in either of its two forms**, and it reads
 * `VISUAL.markers.readout` and nothing else — so that one block is where the
 * countdown's appearance is tuned whatever state the dial is in. It briefly
 * was not so: the compact form's numbers lived under `VISUAL.digital` while
 * this component was skipped entirely whenever the clock was on, which left
 * `markers.readout` looking like the place to edit while every value in it was
 * unreachable. One drawer, one block.
 *
 * **The full form** is two lines, `label` over `detail`, and it appears when
 * the countdown has the disc to itself — the digital clock switched off. Its
 * ink is `hubText`'s pair, and the pair **swaps** with the shading behind the
 * block: each glyph is stroked with the opposite tone *underneath* its own
 * fill (`paint-order: stroke`), and which tone is the fill follows the mean
 * lightness of the hours the box spans. `VISUAL.hubText` argues why text at
 * this radius needs both halves of that, and why this form keeps the flip
 * where the digital stack pins its orientation: at 5 units a light fill on a
 * near-white face reads as a hollow outline, which is what this did through a
 * polar day before the flip existed.
 *
 * **The compact form** is one grey line, `Break starts in 1h 45m`, tucked under
 * the clock and the date — which take the room the two lines used. Its ink is
 * fixed rather than flipped, matching the stack it has joined.
 *
 * Either way the block sits below the hub, and the dial puts midnight at the
 * bottom, so **hour 0** is the centre of the stretch its backdrop is meaned
 * over.
 *
 * Drawn before the hands, so a hand sweeps *over* the text a few minutes an
 * hour — the trade of putting a readout on the face rather than beside it, and
 * the same thing a watch with a subdial does. Type this small painted on top of
 * a 3.4-unit hand would make the hand look broken instead, which is why
 * `DigitalReadout` is drawn after the hands and this is not.
 *
 * It is also invisible to assistive technology, the `<svg>` being `role="img"`:
 * `Clock` puts the same sentence in the dial's accessible name, which is the
 * only route text inside it has.
 *
 * The wording is `readoutLines`' decision, not this component's, so both forms
 * say the same thing and a screen reader hears it either way.
 */
export const MarkerReadout = memo(function MarkerReadout({ next, lightness, hour12, compact }: Props) {
  const { label, detail } = readoutLines(next, hour12);
  // Keyed on the profile rather than recomputed per tick: `next` is a fresh
  // object every render, so this component re-renders every two seconds, and
  // the mean only changes when the day does.
  const mean = useMemo(() => meanLightnessAround(lightness, 0, flipSpanHours), [lightness]);
  const { core, halo } = hubInk(mean);

  if (compact) {
    return (
      // Fixed ink, not `hubInk`'s: this line has joined the digital stack, and
      // that stack pins its orientation rather than flipping — see `hubText`.
      <text
        y={readout.compact.y}
        fill={readout.compact.color}
        stroke={dark}
        strokeWidth={readout.compact.haloWidth}
        strokeLinejoin="round"
        paintOrder="stroke"
        textAnchor="middle"
        fontSize={readout.compact.size}
        fontWeight={readout.compact.weight}
      >
        {`${label} ${detail}`}
      </text>
    );
  }

  return (
    <g
      fill={core}
      stroke={halo}
      strokeWidth={readout.haloWidth}
      strokeLinejoin="round"
      paintOrder="stroke"
      textAnchor="middle"
    >
      <text y={readout.label.y} fontSize={readout.label.size} fontWeight={readout.label.weight}>
        {label}
      </text>
      <text y={readout.detail.y} fontSize={readout.detail.size} fontWeight={readout.detail.weight}>
        {detail}
      </text>
    </g>
  );
});
