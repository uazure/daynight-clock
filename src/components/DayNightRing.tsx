import { memo } from 'react';
import { sectorPath } from '../lib/geometry';
import { lightnessToFill } from '../lib/lightness';
import { SAMPLES_PER_DAY } from '../lib/sun';
import { VISUAL } from '../lib/visual';

const { face, ring } = VISUAL;

/** One slice per sample, so this follows the sampling rate, not the config. */
const SLICE_DEG = 360 / SAMPLES_PER_DAY;

interface Props {
  lightness: Float64Array;
}

/**
 * The dial face. Sample 0 is local midnight, which sits at the bottom, so the
 * first slice starts at -180°.
 */
export const DayNightRing = memo(function DayNightRing({ lightness }: Props) {
  const slices = [];

  for (let i = 0; i < lightness.length; i += 1) {
    const start = -180 + i * SLICE_DEG;
    const fill = lightnessToFill(lightness[i]);
    slices.push(
      <path
        key={i}
        d={sectorPath(0, face.radius, start, start + SLICE_DEG + ring.sliceOverlapDeg)}
        fill={fill}
        stroke={fill}
        strokeWidth={ring.sliceStrokeWidth}
      />,
    );
  }

  return <g>{slices}</g>;
});
