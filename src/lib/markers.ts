/**
 * The reader's own times on the dial: up to five moments or intervals, drawn as
 * tinted wedges on the face with a countdown to the next one at the hub.
 *
 * Everything about *what* a marker means lives here; `visual.ts` decides how it
 * looks and `MarkerWedges`/`MarkerReadout` draw it. The module is pure and
 * storage-free — `settings.ts` owns the `localStorage` side and hands the parsed
 * JSON to `parseMarkers`.
 *
 * A marker is a **wall-clock time on the dial's own zone**, which is AGENTS.md
 * rule 2 read straight: one zone decides everything on screen, so picking Tokyo
 * moves the markers with the hands rather than leaving them on the device's
 * clock. Nothing is stored per marker to say so.
 */

import { formatDuration, formatMinutesOfDay } from './time';

/**
 * Deliberately not derived from `SAMPLES_PER_DAY`: a marker is a wall-clock
 * time, so a day is 1440 minutes long here whatever rate the ring samples at.
 */
const MINUTES_PER_DAY = 1440;

/** Five, as asked for. The editor stops offering to add at this count, and
 *  `parseMarkers` truncates, so neither side alone is load-bearing. */
export const MAX_MARKERS = 5;

/**
 * How many characters of a label survive, and why *this* number.
 *
 * The readout's first line is the label plus at most `' starts'`, so 17
 * characters, drawn at `VISUAL.markers.readout.label.size` (6) inside a box
 * `2 * halfWidth` (56) units wide. system-ui averages ~0.52em per character, so
 * 17 come to ~53 units and fit where 18 would not. A node test cannot measure
 * SVG text, so this cap is the only guard there is — move
 * `readout.halfWidth` or `label.size` and this number has to move with it.
 */
export const MAX_LABEL_LENGTH = 10;

export interface Marker {
  /** Trimmed, capped at `MAX_LABEL_LENGTH`, and allowed to be empty — the
   *  readout falls back to naming the time instead. */
  label: string;
  /** Minutes after the dial zone's midnight, 0…1439. */
  start: number;
  /**
   * Where an interval ends, in the same units. `null` means the marker is a
   * *moment* rather than an interval — an alarm, not a working day. An `end`
   * equal to `start` is normalised to `null` on the way in, since a
   * zero-length interval is a moment described the long way round.
   *
   * An `end` *before* `start` is legitimate and means the interval wraps
   * midnight — see `markerSpans`.
   */
  end: number | null;
}

/** One run of a marker within a single day, in minutes after midnight. */
export interface MinuteSpan {
  from: number;
  to: number;
}

export type Phase = 'past' | 'active' | 'upcoming';

export interface NextBoundary {
  marker: Marker;
  /** Which end of the marker this is: an interval in progress yields `end`. */
  kind: 'start' | 'end';
  /** Minutes after midnight at which it happens. */
  at: number;
  /** Minutes from now until then, wrapping to tomorrow. 0 means this minute. */
  inMinutes: number;
}

export function isMoment(marker: Marker): boolean {
  return marker.end === null;
}

/** Minutes after midnight, as a whole minute inside the day. */
function clampMinuteOfDay(value: number): number {
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  return rounded > MINUTES_PER_DAY - 1 ? MINUTES_PER_DAY - 1 : rounded;
}

/**
 * Whatever came out of storage (or out of the editor's half-typed rows), as
 * markers the dial can draw. Anything unrecognisable is dropped rather than
 * repaired: a row with no usable start time is a row the reader has not finished
 * writing, and drawing a guess at it would be worse than drawing nothing.
 *
 * Same defensive shape as `loadOverride` in `location.ts`, and the same reason —
 * this parses data a user could have hand-edited in devtools.
 */
export function parseMarkers(raw: unknown): Marker[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const markers: Marker[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const { label, start, end } = item as Partial<Marker>;
    if (typeof start !== 'number' || !Number.isFinite(start)) {
      continue;
    }

    const from = clampMinuteOfDay(start);
    const to = typeof end === 'number' && Number.isFinite(end) ? clampMinuteOfDay(end) : null;

    markers.push({
      label: typeof label === 'string' ? label.trim().slice(0, MAX_LABEL_LENGTH) : '',
      start: from,
      // A zero-length interval is a moment; normalising here means every
      // consumer can test `end === null` and nothing has to compare the two.
      end: to === null || to === from ? null : to,
    });

    if (markers.length === MAX_MARKERS) {
      break;
    }
  }

  return markers;
}

/**
 * The arcs an interval occupies today; `[]` for a moment, which has no duration
 * to sweep and draws as a radial dash instead.
 *
 * WHY THIS IS NOT `[{ from: start, to: end }]`: an interval may wrap midnight —
 * "asleep 23:00–07:00" is the obvious one — and on the dial that is both ends of
 * the circle rather than one sweep between them. Handing the backwards pair to
 * `sectorPath` fills the complement: the whole day *except* the interval. This is
 * the same failure `daylightArcs` in `dial.ts` exists to avoid, for the same
 * reason, which is why both return a list.
 */
export function markerSpans(marker: Marker): MinuteSpan[] {
  if (marker.end === null) {
    return [];
  }

  if (marker.end < marker.start) {
    return [
      { from: 0, to: marker.end },
      { from: marker.start, to: MINUTES_PER_DAY },
    ];
  }

  return [{ from: marker.start, to: marker.end }];
}

/**
 * Where one span sits relative to now — the emphasis a wedge is drawn with.
 *
 * Per *span* rather than per marker on purpose: for an interval that wraps
 * midnight the two halves are in different phases for most of the day (asleep
 * 23:00–07:00 seen at noon is a span that has finished and a span that has not
 * started), and one verdict for the whole marker would have to be wrong about
 * one of them.
 *
 * Expects `to > from`; moments go through `momentPhase` instead.
 */
export function spanPhase({ from, to }: MinuteSpan, minuteOfDay: number): Phase {
  if (minuteOfDay >= to) {
    return 'past';
  }
  return minuteOfDay < from ? 'upcoming' : 'active';
}

/**
 * The same for a moment, which is `active` for exactly the minute it names —
 * an alarm has to be loud *at* its own time, and `spanPhase`'s half-open
 * interval would call it past the instant it arrived.
 */
export function momentPhase(start: number, minuteOfDay: number): Phase {
  if (minuteOfDay === start) {
    return 'active';
  }
  return minuteOfDay < start ? 'upcoming' : 'past';
}

/** Minutes from `minuteOfDay` forward to `at`, wrapping into tomorrow. */
function forwardDistance(at: number, minuteOfDay: number): number {
  return (((at - minuteOfDay) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * The single most imminent boundary across every marker — what the readout
 * names and the dial calls out with a crisp radial face.
 *
 * Scans forward and wraps, so at 23:00 the next thing is tomorrow's 07:00 alarm
 * rather than nothing at all; a day with markers in it always has a next
 * boundary, and `null` means the list is empty. A distance of 0 is kept rather
 * than skipped: a boundary happening this very minute is the most imminent one
 * there is, and the readout says "now".
 *
 * Ties are broken by list order, and a marker's own start before its end, so
 * two markers meeting at the same minute resolve the same way on every render.
 */
export function nextBoundary(markers: Marker[], minuteOfDay: number): NextBoundary | null {
  let best: NextBoundary | null = null;

  const consider = (marker: Marker, kind: 'start' | 'end', at: number) => {
    const inMinutes = forwardDistance(at, minuteOfDay);
    if (best === null || inMinutes < best.inMinutes) {
      best = { marker, kind, at, inMinutes };
    }
  };

  for (const marker of markers) {
    consider(marker, 'start', marker.start);
    if (marker.end !== null) {
      consider(marker, 'end', marker.end);
    }
  }

  return best;
}

/**
 * The two lines of the hub readout: what happens, then how long until it does.
 *
 * Here rather than in the component so the wording is testable without a DOM,
 * and so the same strings can be appended to the dial's `aria-label` — the
 * `<svg>` is `role="img"`, so text drawn inside it is never announced, and the
 * label is the only route this readout has to a screen reader.
 *
 * An unlabelled marker names its time instead. That is the whole reason a blank
 * label is allowed to survive `parseMarkers`: "18:00" is a perfectly good thing
 * for the dial to say, and demanding a name to get a countdown would be a
 * validation error over nothing.
 */
export function readoutLines(next: NextBoundary): { label: string; detail: string } {
  const time = formatMinutesOfDay(next.at);
  const named = next.marker.label !== '';

  let label: string;
  if (isMoment(next.marker)) {
    label = named ? next.marker.label : time;
  } else if (next.kind === 'end') {
    label = named ? `${next.marker.label} ends` : `Ends ${time}`;
  } else {
    label = named ? `${next.marker.label} starts` : `Starts ${time}`;
  }

  return {
    label,
    detail: next.inMinutes === 0 ? 'now' : `in ${formatDuration(next.inMinutes)}`,
  };
}
