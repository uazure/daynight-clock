import { memo } from 'react';
import type { YearDragHandlers } from '../hooks/useYearDrag';
import { sectorPath, toCartesian } from '../lib/geometry';
import { VISUAL } from '../lib/visual';
import { angleForDayOfYear } from '../lib/year';

const { yearKnob } = VISUAL;
const { hit } = yearKnob;

/**
 * The pointer, as a path pointing inward at the track.
 *
 * A teardrop rather than a bare triangle: the outward end is an arc of radius
 * `halfBase` instead of a straight chord, which at ~4px reads as deliberate where
 * a flat chord reads clipped, and costs one arc command. Built at the top of the
 * dial and rotated into place, so the shape itself is written once in plain
 * coordinates rather than in trigonometry.
 */
const KNOB_PATH = [
  `M 0 ${-yearKnob.apex}`,
  `L ${-yearKnob.halfBase} ${-yearKnob.base}`,
  `A ${yearKnob.halfBase} ${yearKnob.halfBase} 0 0 1 ${yearKnob.halfBase} ${-yearKnob.base}`,
  'Z',
].join(' ');

interface Props {
  dayOfYear: number;
  total: number;
  /** Whether the keyboard focus ring should show — see `YearSlider`. */
  focusVisible: boolean;
  dragging: boolean;
  handlers: YearDragHandlers;
}

export const YearKnob = memo(function YearKnob({ dayOfYear, total, focusVisible, dragging, handlers }: Props) {
  const angle = angleForDayOfYear(dayOfYear, total);
  const at = toCartesian((yearKnob.apex + yearKnob.base) / 2, angle);

  return (
    <g>
      {focusVisible && (
        <circle
          cx={at.x}
          cy={at.y}
          r={(yearKnob.base - yearKnob.apex) / 2 + 1.4}
          fill="none"
          stroke="var(--dial-outline)"
          strokeWidth={0.7}
        />
      )}

      {/*
        Rotated rather than trigonometrically placed: the path is authored at the
        top of the dial, and `rotate` puts it where the day is. Angles here are
        the dial's own — 0 up, clockwise — which is what SVG's `rotate` does too.
      */}
      <g transform={`rotate(${angle})`}>
        <path d={KNOB_PATH} fill={yearKnob.color} />
      </g>

      {/*
        The grab target: invisible, far larger than the knob, and travelling with
        it. A wedge rather than the whole ring, so a stray tap near the dial's edge
        cannot silently change the date — and `fill="transparent"` rather than
        `none`, because `none` is not hit-testable.

        Last child of the whole `<svg>` (see `Clock`), since everything else
        defaults to `pointer-events: visiblePainted` and a painted element after
        this one would win the hit test.
      */}
      <path
        className="year-hit"
        d={sectorPath(hit.inner, hit.outer, angle - hit.halfAngleDeg, angle + hit.halfAngleDeg)}
        fill="transparent"
        data-dragging={dragging ? '' : undefined}
        {...handlers}
      />
    </g>
  );
});
