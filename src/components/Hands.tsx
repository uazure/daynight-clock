import { angleForHour, angleForMinute, toCartesian } from '../lib/geometry';
import { hoursSinceMidnightInZone, wallClockInZone } from '../lib/time';
import { VISUAL } from '../lib/visual';

const { hands } = VISUAL;

interface HandProps {
  angle: number;
  length: number;
  width: number;
}

function Hand({ angle, length, width }: HandProps) {
  const tip = toCartesian(length, angle);
  const tail = toCartesian(-hands.tail, angle);

  return (
    <g>
      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke={hands.halo}
        strokeWidth={width + hands.haloBleed}
        strokeLinecap="round"
      />
      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke={hands.core}
        strokeWidth={width}
        strokeLinecap="round"
      />
    </g>
  );
}

interface Props {
  now: Date;
  /** IANA zone whose wall clock the hands show. */
  timeZone: string;
}

export function Hands({ now, timeZone }: Props) {
  const hours = hoursSinceMidnightInZone(now, timeZone);
  // Read in the place's zone, not the device's — a half- or quarter-hour
  // offset zone (Kathmandu, +5:45) puts even the minute hand somewhere else.
  const wall = wallClockInZone(now, timeZone);
  const minuteAngle = angleForMinute(wall.minute + wall.second / 60);

  return (
    <g>
      <Hand angle={minuteAngle} length={hands.minute.length} width={hands.minute.width} />
      <Hand angle={angleForHour(hours)} length={hands.hour.length} width={hands.hour.width} />
      <circle r={hands.hub.radius} fill={hands.core} stroke={hands.halo} strokeWidth={hands.hub.haloWidth} />
    </g>
  );
}
