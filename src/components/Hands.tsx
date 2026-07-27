import { DIAL } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { hoursSinceLocalMidnight } from '../lib/sun'

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
}

export function Hands({ now }: Props) {
  const hours = hoursSinceLocalMidnight(now)
  // One turn per hour: 6° per minute, 0 minutes straight up.
  const minuteAngle = (now.getMinutes() + now.getSeconds() / 60) * 6

  return (
    <g>
      <Hand angle={minuteAngle} length={DIAL.minuteHand} width={1.4} />
      <Hand angle={angleForHour(hours)} length={DIAL.hourHand} width={3.4} />
      <circle r={DIAL.hub} fill={CORE} stroke={HALO} strokeWidth={1} />
    </g>
  )
}
