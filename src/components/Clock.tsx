import type { DayProfile } from '../lib/sun';
import { VISUAL } from '../lib/visual';
import { DayNightRing } from './DayNightRing';
import { Hands } from './Hands';
import { HourLabels } from './HourLabels';
import { MinuteLabels } from './MinuteLabels';
import { Ticks } from './Ticks';

const { canvas, face } = VISUAL;
const viewBox = `${-canvas.extent} ${-canvas.extent} ${canvas.extent * 2} ${canvas.extent * 2}`;

interface Props {
  now: Date;
  profile: DayProfile;
  /** IANA zone whose wall clock the dial shows. */
  timeZone: string;
}

export function Clock({ now, profile, timeZone }: Props) {
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });

  return (
    <svg className="clock" viewBox={viewBox} role="img" aria-label={`24-hour day and night clock, ${time}`}>
      <DayNightRing lightness={profile.lightness} />
      <Ticks lightness={profile.lightness} />
      {/*
        The dial's silhouette, painted after the ticks so their round caps
        cannot notch it — drawn first, all 24 of them broke the circle where
        they crossed. It has to read against both ends of the lightness ramp and
        against the page behind it, so the colour is a mid-tone hairline between
        the extremes; the value and its measured contrast ratios live with the
        other theme tokens in styles.css. A near-black stroke once disappeared
        through the night sector and for the whole of a polar night, which is
        why it is a token and not black.
      */}
      <circle r={face.radius} fill="none" stroke={face.rim.color} strokeWidth={face.rim.width} />
      <HourLabels lightness={profile.lightness} />
      <MinuteLabels />
      <Hands now={now} timeZone={timeZone} />
    </svg>
  );
}
