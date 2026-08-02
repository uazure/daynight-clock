import { type Marker, nextBoundary, readoutLines } from '../lib/markers';
import type { DayProfile, SunEvents } from '../lib/sun';
import { formatMinutesOfDay, hoursSinceMidnightInZone } from '../lib/time';
import { VISUAL } from '../lib/visual';
import { DayNightRing } from './DayNightRing';
import { Hands } from './Hands';
import { HourLabels } from './HourLabels';
import { MarkerReadout } from './MarkerReadout';
import { MarkerWedges } from './MarkerWedges';
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
  /** The reader's own times. Empty is the off state, for the same reason. */
  markers: Marker[];
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

export function Clock({ now, profile, timeZone, events, markers }: Props) {
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  // Whole minutes, and computed once here rather than inside each child: it is
  // what both marker layers are keyed on, so passing an integer is what keeps
  // them re-rendering once a minute instead of on every two-second tick of
  // `useNow`.
  const minuteOfDay = Math.floor(hoursSinceMidnightInZone(now, timeZone) * 60);
  const next = nextBoundary(markers, minuteOfDay);
  // The readout is drawn inside the `<svg>`, and this element is `role="img"`, so
  // nothing in it is ever announced. Same reason the sunrise and sunset times are
  // in this string: the accessible name is the only route out.
  const spoken = next ? readoutLines(next) : null;
  const upNext = spoken ? `, ${spoken.label} ${spoken.detail}` : '';
  const label = `24-hour day and night clock, ${time}${events ? sunSummary(events) : ''}${upNext}`;

  return (
    <svg className="clock" viewBox={viewBox} role="img" aria-label={label}>
      <DayNightRing lightness={profile.lightness} />
      {/*
        On the face, under everything the face is read *against*: the band stops
        at 59, inside the hour numerals, so no numeral, tick or rim ever sits on
        a tint and every contrast ratio measured for them still holds.
      */}
      <MarkerWedges markers={markers} minuteOfDay={minuteOfDay} next={next} />
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
      {/*
        Before the hands rather than after, so a hand passes over the countdown
        instead of being cut in half by it — see `MarkerReadout` on that trade.
      */}
      {next && <MarkerReadout next={next} />}
      <Hands now={now} timeZone={timeZone} />
    </svg>
  );
}
