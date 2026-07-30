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
      {/*
        The dial's silhouette, so it has to read against both ends of the
        lightness ramp and against the page behind it. A mid-tone hairline sits
        between the extremes: contrast ratio ~3.7 against the brightest fill
        (L 96%), ~4.3 against the darkest (L 10.5%) and ~4.6 against the page
        (L 8%). The previous near-black stroke was darker than both the page and
        the ramp floor, so the outline disappeared through the night sector and
        for the whole of a polar night.
      */}
      <circle r={DIAL.face} fill="none" stroke="hsl(220 14% 52%)" strokeWidth={1} />
      <Ticks lightness={profile.lightness} />
      <HourLabels lightness={profile.lightness} />
      <Hands now={now} />
    </svg>
  )
}
