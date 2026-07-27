import { memo } from 'react'
import { DIAL, sampleIndexForHour } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { contrastInk } from '../lib/lightness'

interface Props {
  lightness: Float64Array
}

/** Every third hour, matching the settings the 2013 page actually used. */
export const HourLabels = memo(function HourLabels({ lightness }: Props) {
  const labels = []

  for (let hour = 0; hour < 24; hour += 3) {
    const at = toCartesian(DIAL.hourLabel, angleForHour(hour))

    labels.push(
      <text
        key={hour}
        x={at.x}
        y={at.y}
        fill={contrastInk(lightness[sampleIndexForHour(hour)])}
        fontSize={7}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {hour}
      </text>,
    )
  }

  return <g>{labels}</g>
})
