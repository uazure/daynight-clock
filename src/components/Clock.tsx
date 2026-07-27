import { DayNightRing } from './DayNightRing'
import { Hands } from './Hands'
import { HourLabels } from './HourLabels'
import { Ticks } from './Ticks'
import { DIAL } from '../lib/dial'
import type { DayProfile } from '../lib/sun'

interface Props {
  now: Date
  profile: DayProfile
}

export function Clock({ now, profile }: Props) {
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <svg
      className="clock"
      viewBox="-100 -100 200 200"
      role="img"
      aria-label={`24-hour day and night clock, ${time}`}
    >
      <DayNightRing lightness={profile.lightness} />
      <circle
        r={DIAL.face}
        fill="none"
        stroke="hsl(220 14% 10% / 0.35)"
        strokeWidth={1}
      />
      <Ticks lightness={profile.lightness} />
      <HourLabels lightness={profile.lightness} />
      <Hands now={now} />
    </svg>
  )
}
