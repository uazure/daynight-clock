import { memo } from 'react'
import { DIAL } from '../lib/dial'
import { sectorPath } from '../lib/geometry'
import { lightnessToFill } from '../lib/lightness'
import { SAMPLES_PER_DAY } from '../lib/sun'

const SLICE_DEG = 360 / SAMPLES_PER_DAY
/** Slices overlap slightly, so antialiasing leaves no hairline seams. */
const OVERLAP_DEG = 0.08

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
    slices.push(
      <path
        key={i}
        d={sectorPath(0, DIAL.face, start, start + SLICE_DEG + OVERLAP_DEG)}
        fill={lightnessToFill(lightness[i])}
      />,
    )
  }

  return <g>{slices}</g>
})
