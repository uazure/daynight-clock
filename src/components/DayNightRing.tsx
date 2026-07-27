import { memo } from 'react'
import { DIAL } from '../lib/dial'
import { sectorPath } from '../lib/geometry'
import { lightnessToFill } from '../lib/lightness'
import { SAMPLES_PER_DAY } from '../lib/sun'

const SLICE_DEG = 360 / SAMPLES_PER_DAY
/** Slices overlap slightly in angle, so antialiasing leaves no hairline seams. */
const OVERLAP_DEG = 0.4
/**
 * Each slice is stroked with its own fill so the painted shape extends
 * slightly past its geometric edge, covering the anti-aliased gap between
 * neighbours (and the many wedge edges converging on the hub) instead of
 * relying on angular overlap alone.
 */
const SLICE_STROKE_WIDTH = 0.6

interface Props {
  lightness: Float64Array
}

/**
 * The dial face. Sample 0 is local midnight, which sits at the bottom, so the
 * first slice starts at -180°.
 */
export const DayNightRing = memo(function DayNightRing({ lightness }: Props) {
  const slices = []

  for (let i = 0; i < lightness.length; i += 1) {
    const start = -180 + i * SLICE_DEG
    const fill = lightnessToFill(lightness[i])
    slices.push(
      <path
        key={i}
        d={sectorPath(0, DIAL.face, start, start + SLICE_DEG + OVERLAP_DEG)}
        fill={fill}
        stroke={fill}
        strokeWidth={SLICE_STROKE_WIDTH}
      />,
    )
  }

  return <g>{slices}</g>
})
