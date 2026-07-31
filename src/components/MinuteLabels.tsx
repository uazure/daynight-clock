import { memo } from 'react'
import { DIAL, DIAL_TYPE, MINUTE_LABEL_STEP } from '../lib/dial'
import { angleForMinute, toCartesian } from '../lib/geometry'

/**
 * The minute scale, on a band outside the shaded face — read like a bezel,
 * with the minute hand pointing across the face outline at it.
 *
 * It has to live out here. Every labelled minute shares an angle with a
 * labelled hour (minute 10 with hour 16, minute 30 with hour 0), so only
 * radius can separate the two scales, and inside the face there is nowhere
 * far enough from the hour numerals to go. Out here the backdrop is also the
 * page rather than the day/night gradient, so one static, deliberately quiet
 * colour per theme is enough — no flipping with the shading, and nothing
 * competing with the hours or the hands.
 *
 * Zero-padded, so `00` never reads as the hour `0` directly opposite it.
 */
export const MinuteLabels = memo(function MinuteLabels() {
  const labels = []

  for (let minute = 0; minute < 60; minute += MINUTE_LABEL_STEP) {
    const at = toCartesian(DIAL.minuteLabel, angleForMinute(minute))

    labels.push(
      <text
        key={minute}
        x={at.x}
        y={at.y}
        fill="var(--minute-ink)"
        fontSize={DIAL_TYPE.minuteLabel}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {String(minute).padStart(2, '0')}
      </text>,
    )
  }

  return <g>{labels}</g>
})
