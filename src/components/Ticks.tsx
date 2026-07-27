import { memo } from 'react'
import { DIAL, sampleIndexForHour } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { contrastInk } from '../lib/lightness'

interface Props {
  lightness: Float64Array
}

export const Ticks = memo(function Ticks({ lightness }: Props) {
  const ticks = []

  for (let hour = 0; hour < 24; hour += 1) {
    const strong = hour % 3 === 0
    const angle = angleForHour(hour)
    const outer = toCartesian(DIAL.face, angle)
    const inner = toCartesian(
      strong ? DIAL.hourTickInnerStrong : DIAL.hourTickInner,
      angle,
    )

    ticks.push(
      <line
        key={hour}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={contrastInk(lightness[sampleIndexForHour(hour)])}
        strokeWidth={strong ? 1.6 : 0.6}
        strokeLinecap="round"
      />,
    )
  }

  return <g>{ticks}</g>
})
