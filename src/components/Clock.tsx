import { DayNightRing } from './DayNightRing'
import { Hands } from './Hands'
import { HourLabels } from './HourLabels'
import { MinuteLabels } from './MinuteLabels'
import { Ticks } from './Ticks'
import { DIAL } from '../lib/dial'
import type { DayProfile } from '../lib/sun'

interface Props {
  now: Date
  profile: DayProfile
  /** IANA zone whose wall clock the dial shows. */
  timeZone: string
}

export function Clock({ now, profile, timeZone }: Props) {
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
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
        lightness ramp and against the page behind it — a mid-tone hairline
        between the extremes. The value and its measured contrast ratios live
        with the other theme tokens in styles.css; a near-black stroke once
        disappeared through the night sector and for the whole of a polar
        night, which is why it is a token and not black.
      */}
      <circle r={DIAL.face} fill="none" stroke="var(--dial-outline)" strokeWidth={1} />
      <Ticks lightness={profile.lightness} />
      <HourLabels lightness={profile.lightness} />
      <MinuteLabels />
      <Hands now={now} timeZone={timeZone} />
    </svg>
  )
}
