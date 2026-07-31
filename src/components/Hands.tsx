import { DIAL } from '../lib/dial'
import { angleForHour, angleForMinute, toCartesian } from '../lib/geometry'
import { hoursSinceMidnightInZone, wallClockInZone } from '../lib/time'

const HALO = 'hsl(220 12% 96% / 0.55)'
const CORE = 'hsl(220 14% 10%)'

interface HandProps {
  angle: number
  length: number
  width: number
}

function Hand({ angle, length, width }: HandProps) {
  const tip = toCartesian(length, angle)
  const tail = toCartesian(-DIAL.hub, angle)

  return (
    <g>
      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke={HALO}
        strokeWidth={width + 1.6}
        strokeLinecap="round"
      />
      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke={CORE}
        strokeWidth={width}
        strokeLinecap="round"
      />
    </g>
  )
}

interface Props {
  now: Date
  /** IANA zone whose wall clock the hands show. */
  timeZone: string
}

export function Hands({ now, timeZone }: Props) {
  const hours = hoursSinceMidnightInZone(now, timeZone)
  // Read in the place's zone, not the device's — a half- or quarter-hour
  // offset zone (Kathmandu, +5:45) puts even the minute hand somewhere else.
  const wall = wallClockInZone(now, timeZone)
  const minuteAngle = angleForMinute(wall.minute + wall.second / 60)

  return (
    <g>
      <Hand angle={minuteAngle} length={DIAL.minuteHand} width={1.4} />
      <Hand angle={angleForHour(hours)} length={DIAL.hourHand} width={3.4} />
      <circle r={DIAL.hub} fill={CORE} stroke={HALO} strokeWidth={1} />
    </g>
  )
}
