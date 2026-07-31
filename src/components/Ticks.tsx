import { memo } from 'react'
import { DIAL, HOUR_LABEL_STEP, sampleIndexForHour } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { contrastInk } from '../lib/lightness'

interface Props {
  lightness: Float64Array
}

/** Hours per quarter-day — the coarsest tier, and the easiest to find. */
const ANCHOR_STEP = 6

/**
 * Three tiers of emphasis, so the eye has somewhere to land before it starts
 * counting: the quarter-day anchors (midnight, dawn, noon, dusk) are longest
 * and heaviest, the hours carrying a numeral are next, and the remaining
 * hours are hairlines.
 */
function tierFor(hour: number) {
  if (hour % ANCHOR_STEP === 0) return { inner: DIAL.tickInner.every6h, width: 1.6 }
  if (hour % HOUR_LABEL_STEP === 0) return { inner: DIAL.tickInner.every2h, width: 1 }
  return { inner: DIAL.tickInner.every1h, width: 0.5 }
}

export const Ticks = memo(function Ticks({ lightness }: Props) {
  const ticks = []

  for (let hour = 0; hour < 24; hour += 1) {
    const { inner, width } = tierFor(hour)
    const angle = angleForHour(hour)
    const from = toCartesian(DIAL.face, angle)
    const to = toCartesian(inner, angle)

    ticks.push(
      <line
        key={hour}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={contrastInk(lightness[sampleIndexForHour(hour)])}
        strokeWidth={width}
        strokeLinecap="round"
      />,
    )
  }

  return <g>{ticks}</g>
})
