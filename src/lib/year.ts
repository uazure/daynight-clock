/**
 * The year as one turn of the dial, and the calendar arithmetic that needs.
 *
 * Two scales meet here. The **day** scale is the clock's own: 24 hours to a
 * turn, midnight at the bottom. The **year** scale is this module's: one year to
 * a turn, 1 January at the bottom — the same place, because `angleForDayOfYear`
 * measures from `angleForHour(0)` rather than from a literal. Import the
 * function, never the number: the two only stay aligned while the year's origin
 * is derived from the day's, and `year.test.ts` pins that they are.
 *
 * A day is identified two ways, and both appear in these signatures:
 *
 * - a **`dateKey`**, `'YYYY-MM-DD'`, which is what `sampleDay` and
 *   `dateKeyInZone` in `time.ts` speak, and
 * - a **`dayOfYear`**, 1-based, which is what an angle converts to and from.
 *
 * ON DOING THIS WITH `Date.UTC` AND NOT ELAPSED MILLISECONDS: every function
 * below builds and reads dates through `Date.UTC` and the `getUTC*` getters, and
 * `dayOfYearForDateKey` divides a difference of two `Date.UTC` values by
 * 86,400,000. That looks like the thing commit 172c4d1 forbade and is not. That
 * ban is on deriving *zoned* instants by adding elapsed time, where a DST
 * transition makes a local day 23 or 25 hours long and the arithmetic silently
 * drifts an hour. There is no zone in a `Date.UTC` value, and a UTC day is
 * always exactly 86,400,000 ms. The zone enters one level down, inside
 * `instantForZoneWallClock`, which is where it belongs and where it is tested.
 * Do not "fix" this into local-time getters: a device west of UTC would then
 * read 1 January as 31 December.
 */

import { angleForHour, normalizeAngle } from './geometry';

/**
 * Where the year starts on the dial: with hour 0, at the bottom.
 *
 * Derived, not written as `-180`, so the year scale cannot drift from the hour
 * scale — the knob at New Year lines up with the midnight tick beneath it
 * because both come from this one expression.
 */
export const YEAR_ZERO_ANGLE_DEG = angleForHour(0);

/** Days in each month of a non-leap year, January first. */
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MS_PER_DAY = 86_400_000;

/** The proleptic Gregorian rule: 2024 and 2000 yes, 2026 and 1900 no. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** How many days the knob's full turn covers. */
export function daysInYear(year: number): 365 | 366 {
  return isLeapYear(year) ? 366 : 365;
}

/** The year a `'YYYY-MM-DD'` key names. */
export function yearOfDateKey(dateKey: string): number {
  return Number(dateKey.slice(0, 4));
}

/** 1-based day of the year for a `'YYYY-MM-DD'` key: 1 Jan is 1, 29 Feb is 60. */
export function dayOfYearForDateKey(dateKey: string): number {
  const year = yearOfDateKey(dateKey);
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  return (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / MS_PER_DAY + 1;
}

/**
 * `dayOfYear` folded into `[1, total]`. Day 366 of a 365-day year becomes day 1,
 * day 0 becomes day 365 — which is what makes the knob wrap at the seam instead
 * of stopping there.
 */
export function wrapDayOfYear(dayOfYear: number, total: number): number {
  return ((((dayOfYear - 1) % total) + total) % total) + 1;
}

/** `dayOfYear` clamped to `[1, total]`, for values that must not wrap. */
export function clampDayOfYear(dayOfYear: number, total: number): number {
  return Math.min(total, Math.max(1, Math.round(dayOfYear)));
}

/**
 * The `'YYYY-MM-DD'` key for day `dayOfYear` of `year`.
 *
 * Wraps rather than overflows, and that is load-bearing: `Date.UTC(2026, 0, 366)`
 * quietly rolls into 2027, so without the fold the knob would scroll into the
 * next year and the ring would stop being one year round. This function is the
 * single place that guarantee lives.
 */
export function dateKeyForDayOfYear(year: number, dayOfYear: number): string {
  const day = wrapDayOfYear(Math.round(dayOfYear), daysInYear(year));
  const at = new Date(Date.UTC(year, 0, day));
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `${at.getUTCFullYear()}-${month}-${String(at.getUTCDate()).padStart(2, '0')}`;
}

/** The 1-based day each month starts on: `[1, 32, 60, …]`, twelve of them. */
export function monthStartDays(year: number): number[] {
  const leap = isLeapYear(year);
  const starts: number[] = [];
  let day = 1;
  for (let month = 0; month < 12; month += 1) {
    starts.push(day);
    day += MONTH_LENGTHS[month] + (leap && month === 1 ? 1 : 0);
  }
  return starts;
}

/**
 * The dial angle where day `dayOfYear` begins.
 *
 * Indexed at the **start** of the day's slice rather than its middle, matching
 * how `DayNightRing` places its minute slices. The difference is under a degree
 * and invisible, and the payoff is exact: day 1 lands on `YEAR_ZERO_ANGLE_DEG`
 * itself, so the knob at New Year is precisely over the midnight tick.
 */
export function angleForDayOfYear(dayOfYear: number, total: number): number {
  return normalizeAngle(YEAR_ZERO_ANGLE_DEG + ((dayOfYear - 1) / total) * 360);
}

/**
 * How much of a day to forgive when deciding which slice an angle falls in.
 *
 * `angleForDayOfYear` divides by `total` and `dayOfYearForAngle` multiplies back,
 * and in binary floating point those two do not compose exactly: for day 365 of
 * a 365-day year the round trip lands on 363.99999999999994, and `floor` reads
 * that as the day before. Without this nudge **250 of the 731 days** in a leap
 * and a common year come back one short — the boundary case is the common case
 * here, not a rarity, because every day's angle *is* a slice boundary.
 *
 * Sized to sit far above the error it absorbs (~6e-14 of a day) and far below
 * anything a reader could express: a millionth of a day of dial arc is a
 * thousandth of a pixel. Neither multiplication order fixes this on its own —
 * both `(f / 360) * total` and `(f * total) / 360` were measured, and both drop
 * the same days.
 */
const SLICE_EPSILON_DAYS = 1e-9;

/**
 * Which day's slice contains `angleDeg`. Accepts any angle and wraps, so a
 * pointer dragged past 31 December answers 1 January rather than running out of
 * range.
 */
export function dayOfYearForAngle(angleDeg: number, total: number): number {
  const fromOrigin = (((angleDeg - YEAR_ZERO_ANGLE_DEG) % 360) + 360) % 360;
  // `min` guards the case where the epsilon carries the floor up to `total`
  // itself at the very end of the year.
  return Math.min(total, 1 + Math.floor((fromOrigin / 360) * total + SLICE_EPSILON_DAYS));
}

/** `dayOfYear` moved `days`, wrapping inside the year. */
export function stepDayOfYear(dayOfYear: number, days: number, total: number): number {
  return wrapDayOfYear(dayOfYear + days, total);
}

/**
 * `dayOfYear` moved `delta` whole months, staying inside `year`.
 *
 * Keeps the day of the month where the target month has one, so 31 January + 1
 * is the end of February rather than 3 March — a month step that skipped over a
 * month would be a strange thing for PageUp to do. December + 1 wraps to January
 * of the same year, for the same reason the day step wraps.
 */
export function stepMonths(year: number, dayOfYear: number, delta: number): number {
  const total = daysInYear(year);
  const at = new Date(Date.UTC(year, 0, wrapDayOfYear(dayOfYear, total)));
  const month = at.getUTCMonth();
  const day = at.getUTCDate();

  const targetMonth = (((month + delta) % 12) + 12) % 12;
  const monthLength = MONTH_LENGTHS[targetMonth] + (isLeapYear(year) && targetMonth === 1 ? 1 : 0);
  return monthStartDays(year)[targetMonth] + Math.min(day, monthLength) - 1;
}

/**
 * The day a keystroke selects, or `null` when the key is not one of ours — which
 * is what lets the handler call `preventDefault` only for keys it consumed, so
 * Tab and Escape still reach the sheet machinery.
 *
 * Arrow *Right* is later in the year whatever the writing direction: a native
 * range inverts its arrows under `dir="rtl"`, and this is a dial, where
 * clockwise is clockwise. Home and End land on the year's ends rather than
 * wrapping, because that is what a reader means by pressing them.
 */
export function dayForKey(key: string, shift: boolean, dayOfYear: number, year: number): number | null {
  const total = daysInYear(year);
  const step = shift ? 7 : 1;

  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return stepDayOfYear(dayOfYear, step, total);
    case 'ArrowLeft':
    case 'ArrowDown':
      return stepDayOfYear(dayOfYear, -step, total);
    case 'PageUp':
      return stepMonths(year, dayOfYear, 1);
    case 'PageDown':
      return stepMonths(year, dayOfYear, -1);
    case 'Home':
      return 1;
    case 'End':
      return total;
    default:
      return null;
  }
}

/**
 * The date as the reader sees it — in the footer, and as the slider's
 * `aria-valuetext`.
 *
 * THE ONE PLACE THIS MODULE BUILDS A LOCAL DATE RATHER THAN A UTC ONE, and
 * deliberately: a *local* midnight read back by a formatter in that same local
 * zone names the intended date in every zone on earth, with nothing to
 * configure. The obvious alternative — a UTC midnight plus `timeZone: 'UTC'` —
 * is equally correct but only while both halves are present, and dropping the
 * option is invisible from anywhere east of Greenwich: here in the suite's
 * Europe/Prague, UTC midnight is 01:00 or 02:00 the *same* day, so the bug would
 * ship green and mislabel every date for readers in the Americas. A failure mode
 * no test in this timezone can see is worth designing out rather than guarding.
 *
 * Note this formats a **calendar date, not an instant**: which zone the dial runs
 * on is irrelevant, because the knob selects a day of the year and not a moment.
 *
 * `locale` is a parameter only so the suite can pin one; nothing passes it.
 */
export function formatDayOfYear(year: number, dayOfYear: number, locale?: string): string {
  const at = new Date(year, 0, wrapDayOfYear(dayOfYear, daysInYear(year)));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(at);
}
