/**
 * Wall-clock arithmetic in an explicit IANA zone, via `Intl` only — no DOM,
 * no device-zone dependence. Everything the app renders (hands, ring
 * sampling, date keys) goes through this module so that a chosen city's
 * clock is its own, not the device's.
 */

export interface WallClock {
  year: number;
  /** 1–12, unlike `Date#getMonth`. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Formatters are expensive to construct and the app asks about the same one
 * or two zones thousands of times per day profile.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      // h23 keeps midnight as "00", where h24 would read "24".
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Current UTC offset of a zone, in minutes; `null` for an unknown zone.
 *
 * Deliberately builds a fresh formatter per call: location tests stub
 * `Intl.DateTimeFormat` per test to fake device zones, and a cached formatter
 * would carry one test's fake into the next. Hot paths use the cached-
 * formatter derivation below instead.
 */
export function zoneOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;

    if (!name) {
      return null;
    }
    if (name === 'GMT') {
      return 0;
    }

    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name);
    if (!match) {
      return null;
    }

    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  } catch {
    return null;
  }
}

/** The wall clock an observer in `timeZone` reads at `instant`. */
export function wallClockInZone(instant: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value === undefined ? Number.NaN : Number(value);
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** `YYYY-MM-DD` as read in `timeZone` — the memo key for a day's profile. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  const wall = wallClockInZone(instant, timeZone);
  const month = String(wall.month).padStart(2, '0');
  const day = String(wall.day).padStart(2, '0');
  return `${wall.year}-${month}-${day}`;
}

/**
 * Offset derived from the cached wall-clock formatter: what the zone's clock
 * reads, reinterpreted as UTC, minus the instant itself. Equivalent to
 * `zoneOffsetMinutes` but ~an order of magnitude cheaper per call, which
 * matters to `sampleDay`'s 1440 inversions per day profile.
 */
function fastOffsetMinutes(timeZone: string, atMs: number): number {
  const wall = wallClockInZone(new Date(atMs), timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  // Offsets are whole minutes; rounding absorbs the instant's sub-second part.
  return Math.round((asUtc - atMs) / 60_000);
}

/**
 * The instant at which `timeZone`'s wall clock reads `hour:minute` on the day
 * `dateKey` — the inverse of `wallClockInZone`, up to DST's two edge cases.
 *
 * Guess the instant as if the zone were UTC, then correct by the zone's
 * offset, twice: the first correction can land on the far side of a DST
 * transition, and reading the offset again where the guess actually landed
 * settles it. For a spring-forward gap (a wall time that never happens) the
 * result is ~1 h off the phantom time — harmless here, since a sun altitude
 * moves little in an hour and that dial cell covers an hour that never
 * occurred. For a fall-back overlap (a wall time that happens twice) it
 * deterministically picks one of the two instants.
 */
export function instantForZoneWallClock(dateKey: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);

  try {
    const first = fastOffsetMinutes(timeZone, guess);
    const second = fastOffsetMinutes(timeZone, guess - first * 60_000);
    return new Date(guess - second * 60_000);
  } catch {
    // Unknown zone: read the guess as UTC rather than throw mid-render.
    return new Date(guess);
  }
}

/**
 * A zone's UTC offset over a bounded window, as a piecewise-constant function.
 *
 * `base` is the offset at `from`; each entry in `changes` is the first instant
 * reading a new offset, ascending. Both bounds are inclusive, and asking outside
 * them answers `null` rather than guessing — the caller falls back to the
 * `Intl` round-trip.
 */
export interface OffsetTimeline {
  readonly from: number;
  readonly to: number;
  readonly base: number;
  readonly changes: readonly { readonly at: number; readonly offset: number }[];
}

/**
 * How far either side of the day's UTC midnight the probes can reach.
 *
 * `instantForZoneWallClock` asks about two instants: the guess itself, which
 * spans the day, and the guess corrected by an offset, which moves it by at most
 * 14 h east or 12 h west. So the true reach is `[-14h, +36h]`; these bounds add
 * a few hours of slack so the arithmetic need not be re-derived if the offset
 * range ever widens.
 */
const OFFSET_WINDOW_BEFORE_MS = 18 * 3_600_000;
const OFFSET_WINDOW_AFTER_MS = 42 * 3_600_000;

/**
 * Scanning step. An hour is unimpeachable: no zone has ever changed its offset
 * twice within one hour, so no transition can hide between two probes. A coarser
 * scan would save a handful of calls and cost that guarantee.
 */
const OFFSET_PROBE_STEP_MS = 3_600_000;

/**
 * The zone's offsets around the day `dateKey`, in ~67 `Intl` calls instead of the
 * 2880 that sampling a day one minute at a time costs. `null` for an unknown
 * zone, which is the caller's signal to use the slow path.
 *
 * Scan hourly; where two neighbouring probes disagree, bisect that hour down to
 * the minute the change lands on. Every probe is at a whole minute, and so is
 * every instant `instantForZoneWallClockWith` asks about, which is what makes the
 * reproduction exact rather than approximate — see the note there.
 */
export function offsetTimelineForDay(dateKey: string, timeZone: string): OffsetTimeline | null {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayStart = Date.UTC(year, month - 1, day);
  const from = dayStart - OFFSET_WINDOW_BEFORE_MS;
  const to = dayStart + OFFSET_WINDOW_AFTER_MS;

  try {
    const base = fastOffsetMinutes(timeZone, from);
    const changes: { at: number; offset: number }[] = [];
    let previous = base;

    for (let at = from + OFFSET_PROBE_STEP_MS; at <= to; at += OFFSET_PROBE_STEP_MS) {
      const offset = fastOffsetMinutes(timeZone, at);
      if (offset === previous) {
        continue;
      }
      // `low` still reads the old offset, `high` already reads the new one;
      // halve until they are adjacent minutes. Whole minutes throughout: the
      // window starts on a UTC midnight and every step is a whole hour.
      let low = (at - OFFSET_PROBE_STEP_MS) / 60_000;
      let high = at / 60_000;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (fastOffsetMinutes(timeZone, mid * 60_000) === previous) {
          low = mid;
        } else {
          high = mid;
        }
      }
      changes.push({ at: high * 60_000, offset });
      previous = offset;
    }

    return { from, to, base, changes };
  } catch {
    return null;
  }
}

/** The offset at `atMs`, or `null` when that falls outside the timeline. */
export function offsetAtFromTimeline(timeline: OffsetTimeline, atMs: number): number | null {
  if (atMs < timeline.from || atMs > timeline.to) {
    return null;
  }

  let offset = timeline.base;
  for (const change of timeline.changes) {
    if (atMs < change.at) {
      break;
    }
    offset = change.offset;
  }
  return offset;
}

/**
 * `instantForZoneWallClock`, with the offsets read from a prepared timeline
 * instead of from `Intl` — same arguments, same result, ~11× less work per call.
 *
 * THIS DOES NOT CHANGE HOW A SAMPLE INSTANT IS DERIVED, which is the whole
 * reason it is safe. Sample `i` is still resolved from the wall-clock components
 * `(dateKey, hour, minute)` through the same two-step offset correction, in the
 * same order; only where the two offset *numbers* come from has changed, from an
 * `Intl` round-trip to a lookup in a table built out of `Intl` round-trips. The
 * spring-forward gap still resolves the same hour off the phantom time, the
 * fall-back overlap still picks the same one of its two instants, and the last
 * wall-clock hour of a 25-hour day is still sampled. `instantForZoneWallClock`
 * stays exported and untouched as the reference, and `time.test.ts` asserts the
 * two agree to the millisecond for every minute of every day it checks. Keep
 * that test: it is the only thing standing between this optimisation and the
 * class of bug commit 172c4d1 fixed.
 *
 * Falls back to the slow path whenever the timeline cannot answer — an unknown
 * zone, or an instant outside the window — so a wrong answer is never preferred
 * to a slow one.
 */
export function instantForZoneWallClockWith(
  timeline: OffsetTimeline | null,
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  if (timeline === null) {
    return instantForZoneWallClock(dateKey, hour, minute, timeZone);
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);

  const first = offsetAtFromTimeline(timeline, guess);
  const second = first === null ? null : offsetAtFromTimeline(timeline, guess - first * 60_000);
  if (second === null) {
    return instantForZoneWallClock(dateKey, hour, minute, timeZone);
  }

  return new Date(guess - second * 60_000);
}

/**
 * Minutes after midnight → `HH:MM` on a 24-hour clock, to match the dial the
 * reader is looking at. Rounding 23:59:40 up produces minute 1440, which is
 * the next day's `00:00`, so the result wraps rather than reading `24:00`.
 */
export function formatMinutesOfDay(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = String(Math.floor(total / 60)).padStart(2, '0');
  return `${hour}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The inverse of `formatMinutesOfDay` for the `HH:MM` an `<input type="time">`
 * yields; `null` for anything else, empty string included.
 *
 * Strict on purpose. An empty time input is the marker editor's way of saying
 * "this is a moment, not an interval", and a lenient parser that read `''` as
 * midnight would turn every unfinished row into an interval ending at 00:00.
 * Seconds are accepted and dropped: the control emits `HH:MM:SS` when a `step`
 * finer than a minute is in play, and the dial cannot resolve them anyway.
 */
export function minutesFromTimeValue(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

/**
 * A span of minutes as `45m`, `1h 45m` or `2h` — the countdown half of the
 * marker readout, and deliberately not `HH:MM`: "1h 45m" cannot be misread as a
 * time of day, which "01:45" sitting on a clock face certainly can.
 *
 * Whole hours drop the minutes rather than reading `2h 0m`. Negative input is
 * clamped to zero; the caller that has a real elapsed time to show handles the
 * zero case with a word ("now") instead.
 */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (hours === 0) {
    return `${rest}m`;
  }
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Fractional hours since `timeZone`'s midnight, for placing the hands. */
export function hoursSinceMidnightInZone(now: Date, timeZone: string): number {
  const wall = wallClockInZone(now, timeZone);
  return (
    wall.hour +
    wall.minute / 60 +
    wall.second / 3600 +
    // Milliseconds never differ between zones, so the instant's own are fine.
    now.getMilliseconds() / 3_600_000
  );
}
