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
 * Minutes after midnight → `HH:MM` on a 24-hour clock, to match the dial the
 * reader is looking at. Rounding 23:59:40 up produces minute 1440, which is
 * the next day's `00:00`, so the result wraps rather than reading `24:00`.
 */
export function formatMinutesOfDay(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = String(Math.floor(total / 60)).padStart(2, '0');
  return `${hour}:${String(total % 60).padStart(2, '0')}`;
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
