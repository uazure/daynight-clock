import type { YearDragHandlers } from '../hooks/useYearDrag';
import { type Marker, nextBoundary, readoutLines } from '../lib/markers';
import type { DayProfile, SunEvents } from '../lib/sun';
import { clockText, formatClockTime, formatSpokenDate, hoursSinceMidnightInZone } from '../lib/time';
import { VISUAL } from '../lib/visual';
import { DayNightRing } from './DayNightRing';
import { DigitalReadout } from './DigitalReadout';
import { Hands } from './Hands';
import { HourLabels } from './HourLabels';
import { MarkerReadout } from './MarkerReadout';
import { MarkerWedges } from './MarkerWedges';
import { MinuteLabels } from './MinuteLabels';
import { Ticks } from './Ticks';
import { YearKnob } from './YearKnob';

const { canvas, face } = VISUAL;
const viewBox = `${-canvas.extent} ${-canvas.extent} ${canvas.extent * 2} ${canvas.extent * 2}`;

interface Props {
  now: Date;
  profile: DayProfile;
  /** IANA zone whose wall clock the dial shows. */
  timeZone: string;
  /**
   * The day's crossings. **Nothing draws these** — they exist only for
   * `sunSummary` below, which puts sunrise and sunset into the accessible name.
   * They used to also feed the daylight arc; the arc is gone and this stayed,
   * because the label is the only route those two instants have to a screen
   * reader. Delete this prop and they leave the app entirely.
   */
  events: SunEvents;
  /** The reader's own times. Empty is the off state, for the same reason. */
  markers: Marker[];
  /**
   * Whether times are written on a 12-hour clock — the digits at the hub, the
   * countdown's label for an unnamed marker, and the sun times in the
   * accessible name below. A format rather than a switch, which is why this is
   * a plain boolean where `markers` and `knobDay` make absence their off state.
   */
  hour12: boolean;
  /**
   * Whether the digital clock and date are drawn. A plain boolean rather than
   * the `null`-is-off shape `markers` and `knobDay` use, because there is no
   * payload here to make an absence out of — the block draws itself from `now`
   * and the zone this component already has.
   */
  showDigitalTime: boolean;
  /**
   * The day the knob points at, and the size of the year it sits in — or `null`
   * for the whole feature being off, which is the default. `null` rather than a
   * separate boolean so this component never learns that a setting exists: it
   * draws the knob when it is given a day to draw one at, the same idea as
   * `markers` treating an empty list as its off state.
   */
  knobDay: { dayOfYear: number; daysThisYear: number } | null;
  /** The date being simulated, when one is — for the accessible name only. */
  simulatedDate: string | null;
  knobFocusVisible: boolean;
  knobDragging: boolean;
  knobHandlers: YearDragHandlers;
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
function sunSummary({ sunrise, sunset, polar }: SunEvents, hour12: boolean): string {
  if (polar === 'day') {
    return ', daylight all day';
  }
  if (polar === 'night') {
    return ', night all day';
  }

  return [
    sunrise !== null ? `, sunrise ${clockText(formatClockTime(sunrise, hour12))}` : '',
    sunset !== null ? `, sunset ${clockText(formatClockTime(sunset, hour12))}` : '',
  ].join('');
}

/**
 * THE DIAL, AND WHAT THE SIMULATED DATE MAY AND MAY NOT TOUCH.
 *
 * When the reader scrubs the year knob, the chosen day reaches this component by
 * exactly three routes: the `profile` it shades with, the `dayOfYear` the knob is
 * drawn at, and a string in the `aria-label`. **Nothing time-of-day is derived
 * from it.** `minuteOfDay`, `nextBoundary`, `MarkerWedges`, `MarkerReadout` and
 * `Hands` all come off `now`, so the hands keep the real time and the countdown
 * stays a real measurement — guaranteed structurally rather than by care, because
 * there is no simulated `Date` anywhere in the tree to reach for by accident.
 */
export function Clock({
  now,
  profile,
  timeZone,
  events,
  markers,
  hour12,
  showDigitalTime,
  knobDay,
  simulatedDate,
  knobFocusVisible,
  knobDragging,
  knobHandlers,
}: Props) {
  // Whole minutes, and computed once here rather than inside each child: it is
  // what both marker layers are keyed on, so passing an integer is what keeps
  // them re-rendering once a minute instead of on every two-second tick of
  // `useNow`.
  const minuteOfDay = Math.floor(hoursSinceMidnightInZone(now, timeZone) * 60);
  // Off `minuteOfDay` rather than `toLocaleTimeString`, so the label and the
  // digits at the hub come from one zone-aware derivation of the hour instead
  // of two that could disagree — AGENTS.md rule 2 read strictly.
  const time = clockText(formatClockTime(minuteOfDay, hour12));
  const next = nextBoundary(markers, minuteOfDay);
  // The readout is drawn inside the `<svg>`, and this element is `role="img"`, so
  // nothing in it is ever announced. Same reason the sunrise and sunset times are
  // in this string: the accessible name is the only route out.
  const spoken = next ? readoutLines(next, hour12) : null;
  const upNext = spoken ? `, ${spoken.label} ${spoken.detail}` : '';
  // The simulated date goes between the time and the sun times, because the sun
  // times describe the day it names rather than today.
  const shading = simulatedDate === null ? '' : `, shading simulated for ${simulatedDate}`;
  // The date is in the label whether or not the digital block is drawn. The
  // `<svg>` is `role="img"`, so the label is the only route any of this has to
  // a screen reader, and the dial's zone genuinely can be a day ahead of the
  // device's — that is worth saying even to a reader who has the block switched
  // off, the same argument the sun times are here on.
  const date = formatSpokenDate(now, timeZone);
  const label = `24-hour day and night clock, ${time}, ${date}${shading}${sunSummary(events, hour12)}${upNext}`;

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
      <HourLabels lightness={profile.lightness} />
      <MinuteLabels />
      {/*
        Before the hands rather than after, so a hand passes over the countdown
        instead of being cut in half by it — see `MarkerReadout` on that trade.
      */}
      {/*
        The countdown is drawn here whenever there is one, in whichever of its
        two forms fits: two lines with the disc to itself, or one grey caption
        under the clock. `MarkerReadout` owns both, so `markers.readout` is the
        one place either is tuned from.
      */}
      {next && <MarkerReadout next={next} lightness={profile.lightness} hour12={hour12} compact={showDigitalTime} />}
      <Hands now={now} timeZone={timeZone} />
      {/*
        After the hands, unlike the countdown. The hour hand crosses this slot
        in the small hours, and at 12 units the digits are the one thing on the
        face big enough to win that overlap rather than merely survive it: a
        hand drawn on top cuts the numerals in half. The countdown stays under
        the hands because type that small painted over a 3.4-unit hand would be
        the hand that looked broken.
      */}
      {showDigitalTime && <DigitalReadout now={now} timeZone={timeZone} minuteOfDay={minuteOfDay} hour12={hour12} />}
      {/*
        Last of all, because its grab target is a transparent path and everything
        else defaults to `pointer-events: visiblePainted` — a painted element
        after it would win the hit test and the knob would be ungrabbable.
      */}
      {knobDay && (
        <YearKnob
          dayOfYear={knobDay.dayOfYear}
          total={knobDay.daysThisYear}
          focusVisible={knobFocusVisible}
          dragging={knobDragging}
          handlers={knobHandlers}
        />
      )}
    </svg>
  );
}
