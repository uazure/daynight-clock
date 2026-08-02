import { memo } from 'react';
import { type NextBoundary, readoutLines } from '../lib/markers';
import { VISUAL } from '../lib/visual';

const { readout, accent } = VISUAL.markers;

interface Props {
  next: NextBoundary;
}

/**
 * The countdown at the hub: what happens next, and how long until it does.
 *
 * Two `<text>` elements and nothing else — no plate behind them. The halo does
 * that work instead: each glyph is stroked with `readout.halo` *underneath* its
 * own fill (`paint-order: stroke`), so it reads against its outline rather than
 * against the face. That matters here more than anywhere else on the dial,
 * because the ring's 1440 slices all converge on the centre: a glyph at this
 * radius sits over a fan of every lightness the day contains, and no single fill
 * could be chosen against it. This is the case `hourLabels.outlineWidth` keeps
 * the mechanism wired up for.
 *
 * Drawn before the hands, so a hand sweeps *over* the text a few minutes an hour
 * — the trade of putting a readout on the face rather than beside it, and the
 * same thing a watch with a subdial does. It is also invisible to assistive
 * technology, the `<svg>` being `role="img"`: `Clock` puts the same sentence in
 * the dial's accessible name, which is the only route text inside it has.
 *
 * The wording is `readoutLines`' decision, not this component's.
 */
export const MarkerReadout = memo(function MarkerReadout({ next }: Props) {
  const { label, detail } = readoutLines(next);

  return (
    <g
      fill={accent}
      stroke={readout.halo}
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
