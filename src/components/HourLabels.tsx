import { memo } from 'react'
import { DIAL, DIAL_TYPE, HOUR_LABEL_STEP, sampleIndexForHour } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { contrastHalo, contrastInk } from '../lib/lightness'

interface Props {
  lightness: Float64Array
}

/**
 * Every second hour, unpadded — the minute band outside the face pads its own
 * numerals, so `0` against `00` says which scale you are reading. Twelve of
 * them leave ~33 units of arc apiece at this radius, so nothing had to shrink
 * to fit; the size is held up by legibility on a phone, not by crowding.
 *
 * Each numeral is stroked in the opposite tone underneath its fill, the same
 * trick the hands use. Without it a numeral landing where the ramp crosses
 * mid-grey sits at roughly 3.5:1, four times weaker than anywhere else on the
 * dial, and that band is civil twilight — where the reader is most likely to
 * be looking.
 */
export const HourLabels = memo(function HourLabels({ lightness }: Props) {
  const labels = []

  for (let hour = 0; hour < 24; hour += HOUR_LABEL_STEP) {
    const at = toCartesian(DIAL.hourLabel, angleForHour(hour))
    const local = lightness[sampleIndexForHour(hour)]

    labels.push(
      <text
        key={hour}
        x={at.x}
        y={at.y}
        fill={contrastInk(local)}
        stroke={contrastHalo(local)}
        strokeWidth={1.4}
        strokeLinejoin="round"
        paintOrder="stroke"
        fontSize={DIAL_TYPE.hourLabel}
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
