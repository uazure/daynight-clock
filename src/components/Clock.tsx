import type { DayProfile, SunEvents } from '../lib/sun';
import { formatMinutesOfDay } from '../lib/time';
import { VISUAL } from '../lib/visual';
import { DayNightRing } from './DayNightRing';
import { Hands } from './Hands';
import { HourLabels } from './HourLabels';
import { MinuteLabels } from './MinuteLabels';
import { SunArc } from './SunArc';
import { Ticks } from './Ticks';

const { canvas, face } = VISUAL;
const viewBox = `${-canvas.extent} ${-canvas.extent} ${canvas.extent * 2} ${canvas.extent * 2}`;

interface Props {
  now: Date;
  profile: DayProfile;
  /** IANA zone whose wall clock the dial shows. */
  timeZone: string;
  /**
   * The day's crossings, for the daylight arc — `null` when the reader has
   * switched the arc off. Passing `null` rather than a separate boolean keeps
   * this component from knowing that a setting exists: it draws the arc when it
   * has something to draw it from.
   */
  events: SunEvents | null;
}

/**
 * What the sunrise and sunset add to the accessible name.
 *
 * The `<svg>` is `role="img"`, so none of the text inside it is ever announced —
 * which makes this label the only place the times survive for a screen reader
 * now that they are gone from the footer. The polar wording is here for the same
 * reason: sighted readers get it from a dial shaded uniformly light or dark, and
 * this is its only other route out.
 */
function sunSummary({ sunrise, sunset, polar }: SunEvents): string {
  if (polar === 'day') {
    return ', daylight all day';
  }
  if (polar === 'night') {
    return ', night all day';
  }

  return [
    sunrise !== null ? `, sunrise ${formatMinutesOfDay(sunrise)}` : '',
    sunset !== null ? `, sunset ${formatMinutesOfDay(sunset)}` : '',
  ].join('');
}

export function Clock({ now, profile, timeZone, events }: Props) {
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  const label = `24-hour day and night clock, ${time}${events ? sunSummary(events) : ''}`;

  return (
    <svg className="clock" viewBox={viewBox} role="img" aria-label={label}>
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
      {/*
        Outside the rim, so after it. Before the minute numerals rather than
        after: the two are only 0.8 units apart, and if that corridor ever
        tightens the numerals are the ones that must stay legible.
      */}
      {events && <SunArc events={events} />}
      <HourLabels lightness={profile.lightness} />
      <MinuteLabels />
      <Hands now={now} timeZone={timeZone} />
    </svg>
  );
}
