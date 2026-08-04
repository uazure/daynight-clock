import { getTimes } from 'suncalc';
import { describe, expect, it } from 'vitest';
import { sampleIndexForHour } from './dial';
import { angleForHour, angleForPoint, toCartesian } from './geometry';
import { sampleDay, sunEvents } from './sun';
import { instantForZoneWallClock, wallClockInZone } from './time';
import {
  angleForDayOfYear,
  clampDayOfYear,
  dateKeyForDayOfYear,
  dayForKey,
  dayOfYearForAngle,
  dayOfYearForDateKey,
  daysInYear,
  formatDayOfYear,
  isLeapYear,
  monthStartDays,
  stepDayOfYear,
  stepMonths,
  wrapDayOfYear,
  YEAR_ZERO_ANGLE_DEG,
} from './year';

/** A leap year and a common one, used as the pair throughout. */
const LEAP = 2024;
const COMMON = 2026;

describe('the leap rule', () => {
  it('follows the proleptic Gregorian century exceptions', () => {
    expect([2024, 2000, 2020].map(isLeapYear)).toEqual([true, true, true]);
    expect([2026, 1900, 2100, 2025].map(isLeapYear)).toEqual([false, false, false, false]);
  });

  it('sizes the year to match', () => {
    expect(daysInYear(LEAP)).toBe(366);
    expect(daysInYear(COMMON)).toBe(365);
  });
});

describe('days and date keys', () => {
  it('numbers the year from 1 January', () => {
    expect(dayOfYearForDateKey('2026-01-01')).toBe(1);
    expect(dayOfYearForDateKey('2026-12-31')).toBe(365);
    expect(dayOfYearForDateKey('2024-12-31')).toBe(366);
  });

  it('shifts March onward by a day in a leap year', () => {
    expect(dayOfYearForDateKey('2026-03-01')).toBe(60);
    expect(dayOfYearForDateKey('2024-03-01')).toBe(61);
    expect(dayOfYearForDateKey('2024-02-29')).toBe(60);
  });

  it('round-trips every day of a leap and a common year', () => {
    // 731 cases. A sweep rather than samples because an off-by-one here would
    // shade the wrong day, and the wrong day looks entirely plausible.
    for (const year of [LEAP, COMMON]) {
      for (let day = 1; day <= daysInYear(year); day += 1) {
        const key = dateKeyForDayOfYear(year, day);
        expect(dayOfYearForDateKey(key)).toBe(day);
      }
    }
  });

  it('never leaves the year it was asked for', () => {
    // `Date.UTC(2026, 0, 366)` rolls into 2027 on its own, so this is the
    // guarantee that keeps one turn of the ring equal to one year.
    for (const year of [LEAP, COMMON]) {
      for (const day of [-400, -1, 0, 1, 200, 365, 366, 367, 400, 900]) {
        expect(dateKeyForDayOfYear(year, day).startsWith(String(year))).toBe(true);
      }
    }
  });

  it('wraps out-of-range days rather than clamping them', () => {
    expect(dateKeyForDayOfYear(COMMON, 366)).toBe('2026-01-01');
    expect(dateKeyForDayOfYear(COMMON, 0)).toBe('2026-12-31');
    expect(dateKeyForDayOfYear(LEAP, 366)).toBe('2024-12-31');
    expect(dateKeyForDayOfYear(LEAP, 367)).toBe('2024-01-01');
  });

  it('zero-pads both fields', () => {
    expect(dateKeyForDayOfYear(COMMON, 5)).toBe('2026-01-05');
    expect(dateKeyForDayOfYear(COMMON, 60)).toBe('2026-03-01');
  });
});

describe('wrapping and clamping', () => {
  it('wraps a day into range in both directions', () => {
    expect(wrapDayOfYear(366, 365)).toBe(1);
    expect(wrapDayOfYear(0, 365)).toBe(365);
    expect(wrapDayOfYear(-4, 365)).toBe(361);
    expect(wrapDayOfYear(731, 365)).toBe(1);
    expect(wrapDayOfYear(366, 366)).toBe(366);
    expect(wrapDayOfYear(367, 366)).toBe(1);
  });

  it('keeps any step of any size in range', () => {
    for (const total of [365, 366]) {
      for (const days of [-900, -366, -1, 0, 1, 366, 900]) {
        const day = stepDayOfYear(200, days, total);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(total);
      }
    }
  });

  it('clamps instead of wrapping where a value must not move years', () => {
    expect(clampDayOfYear(0, 365)).toBe(1);
    expect(clampDayOfYear(400, 365)).toBe(365);
    expect(clampDayOfYear(200, 365)).toBe(200);
    // A 366 held over from a leap year survives the year rolling over.
    expect(clampDayOfYear(366, 365)).toBe(365);
  });
});

describe('month starts', () => {
  it('lists the twelve first-of-months', () => {
    expect(monthStartDays(COMMON)).toEqual([1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]);
    expect(monthStartDays(LEAP)).toEqual([1, 32, 61, 92, 122, 153, 183, 214, 245, 275, 306, 336]);
  });

  it('starts at day 1, strictly increases, and stays inside the year', () => {
    for (const year of [LEAP, COMMON]) {
      const starts = monthStartDays(year);
      expect(starts).toHaveLength(12);
      expect(starts[0]).toBe(1);
      for (let i = 1; i < starts.length; i += 1) {
        expect(starts[i]).toBeGreaterThan(starts[i - 1]);
      }
      expect(starts[11]).toBeLessThanOrEqual(daysInYear(year));
      // December has 31 days whatever the year, so the last start plus them is
      // exactly the day after the year ends.
      expect(starts[11] + 31).toBe(daysInYear(year) + 1);
    }
  });

  it('agrees with the date keys it claims to mark', () => {
    for (const year of [LEAP, COMMON]) {
      monthStartDays(year).forEach((day, month) => {
        expect(dateKeyForDayOfYear(year, day)).toBe(`${year}-${String(month + 1).padStart(2, '0')}-01`);
      });
    }
  });
});

describe('the year on the dial', () => {
  it('starts the year where the day starts', () => {
    // The headline requirement, and a cross-module pin: 1 January sits at hour 0.
    // Both scales derive from `angleForHour`, and this is what says so.
    expect(YEAR_ZERO_ANGLE_DEG).toBe(angleForHour(0));
    expect(angleForDayOfYear(1, 365)).toBe(angleForHour(0));
    expect(angleForDayOfYear(1, 366)).toBe(angleForHour(0));
    expect(dayOfYearForAngle(angleForHour(0), 365)).toBe(1);
    expect(dayOfYearForAngle(angleForHour(0), 366)).toBe(1);
  });

  it('round-trips every day through its angle', () => {
    for (const total of [365, 366]) {
      for (let day = 1; day <= total; day += 1) {
        expect(dayOfYearForAngle(angleForDayOfYear(day, total), total)).toBe(day);
      }
    }
  });

  it('round-trips every day through a point on the ring', () => {
    // The path a drag actually takes: day → angle → cartesian → angle → day. If
    // `angleForPoint`'s normalisation disagreed with `angleForDayOfYear`'s by a
    // hair, this is where it would show.
    for (const total of [365, 366]) {
      for (let day = 1; day <= total; day += 1) {
        const at = toCartesian(88.6, angleForDayOfYear(day, total));
        expect(dayOfYearForAngle(angleForPoint(at), total)).toBe(day);
      }
    }
  });

  it('holds the selected day anywhere inside its slice', () => {
    // A pointer lands wherever it lands, not on slice boundaries, so most of a
    // cell has to answer the same day as its start.
    for (const total of [365, 366]) {
      const halfCell = 360 / total / 2;
      for (let day = 1; day <= total; day += 1) {
        const centre = angleForDayOfYear(day, total) + halfCell;
        for (const nudge of [-halfCell * 0.8, 0, halfCell * 0.8]) {
          expect(dayOfYearForAngle(centre + nudge, total)).toBe(day);
        }
      }
    }
  });

  it('crosses the New Year seam without landing outside the year', () => {
    // The last day of a 365-day year occupies 179.01°…180°, so the seam sits at
    // 180 ≡ -180 and the two days either side of it are 365 and 1.
    expect(dayOfYearForAngle(-180, 365)).toBe(1);
    expect(dayOfYearForAngle(179, 365)).toBe(364);
    expect(dayOfYearForAngle(179.9, 365)).toBe(365);

    // Stepping a whole slice past the last day lands on the first, of the same
    // year — never day 366 of a 365-day year, and never back onto 365.
    for (const total of [365, 366]) {
      const past = angleForDayOfYear(total, total) + 360 / total;
      expect(dayOfYearForAngle(past, total)).toBe(1);
      // …and a slice before the first day is the last, going the other way.
      expect(dayOfYearForAngle(angleForDayOfYear(1, total) - 360 / total, total)).toBe(total);
    }
  });

  it('answers a day in range for any angle at all', () => {
    for (const total of [365, 366]) {
      for (let deg = -720; deg <= 720; deg += 0.5) {
        const day = dayOfYearForAngle(deg, total);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(total);
      }
    }
  });

  it('puts the top of the dial half a year from New Year', () => {
    expect(dayOfYearForAngle(0, 365)).toBe(183);
    expect(dayOfYearForAngle(0, 366)).toBe(184);
  });

  it('separates the leap and common years at 1 March', () => {
    // The one visible consequence of the leap day: every mark from March on sits
    // a fraction of a degree round from where it does in a common year.
    const common = angleForDayOfYear(dayOfYearForDateKey('2026-03-01'), 365);
    const leap = angleForDayOfYear(dayOfYearForDateKey('2024-03-01'), 366);
    expect(Math.abs(leap - common)).toBeGreaterThan(0.5);
    expect(Math.abs(leap - common)).toBeLessThan(1.5);
  });
});

describe('stepping by months', () => {
  it('keeps the day of the month, clamping where the month is shorter', () => {
    const jan31 = dayOfYearForDateKey('2026-01-31');
    expect(dateKeyForDayOfYear(COMMON, stepMonths(COMMON, jan31, 1))).toBe('2026-02-28');
    expect(dateKeyForDayOfYear(LEAP, stepMonths(LEAP, dayOfYearForDateKey('2024-01-31'), 1))).toBe('2024-02-29');
    expect(dateKeyForDayOfYear(COMMON, stepMonths(COMMON, dayOfYearForDateKey('2026-03-31'), -1))).toBe('2026-02-28');
  });

  it('wraps December to January of the same year', () => {
    expect(dateKeyForDayOfYear(COMMON, stepMonths(COMMON, dayOfYearForDateKey('2026-12-15'), 1))).toBe('2026-01-15');
    expect(dateKeyForDayOfYear(COMMON, stepMonths(COMMON, dayOfYearForDateKey('2026-01-15'), -1))).toBe('2026-12-15');
  });

  it('moves a whole month for an ordinary date', () => {
    expect(dateKeyForDayOfYear(COMMON, stepMonths(COMMON, dayOfYearForDateKey('2026-06-15'), 1))).toBe('2026-07-15');
    expect(dateKeyForDayOfYear(COMMON, stepMonths(COMMON, dayOfYearForDateKey('2026-06-15'), -1))).toBe('2026-05-15');
  });

  it('treats a full turn of months as identity', () => {
    for (const day of [1, 60, 200, 365]) {
      expect(stepMonths(COMMON, day, 0)).toBe(day);
      expect(stepMonths(COMMON, day, 12)).toBe(day);
      expect(stepMonths(COMMON, day, -12)).toBe(day);
    }
  });
});

describe('the keyboard map', () => {
  it('steps a day with the arrows, wrapping at both ends', () => {
    expect(dayForKey('ArrowRight', false, 365, COMMON)).toBe(1);
    expect(dayForKey('ArrowUp', false, 365, COMMON)).toBe(1);
    expect(dayForKey('ArrowLeft', false, 1, COMMON)).toBe(365);
    expect(dayForKey('ArrowDown', false, 1, COMMON)).toBe(365);
    expect(dayForKey('ArrowRight', false, 100, COMMON)).toBe(101);
  });

  it('steps a week with shift held', () => {
    expect(dayForKey('ArrowRight', true, 100, COMMON)).toBe(107);
    expect(dayForKey('ArrowLeft', true, 3, COMMON)).toBe(361);
  });

  it('steps a calendar month with the page keys', () => {
    const jan31 = dayOfYearForDateKey('2026-01-31');
    expect(dateKeyForDayOfYear(COMMON, dayForKey('PageUp', false, jan31, COMMON) ?? 0)).toBe('2026-02-28');
    expect(dateKeyForDayOfYear(COMMON, dayForKey('PageDown', false, 1, COMMON) ?? 0)).toBe('2026-12-01');
  });

  it('lands on the ends of the year with Home and End', () => {
    expect(dayForKey('Home', false, 200, COMMON)).toBe(1);
    expect(dayForKey('End', false, 200, COMMON)).toBe(365);
    expect(dayForKey('End', false, 200, LEAP)).toBe(366);
  });

  it('declines every key it does not own', () => {
    // `null` is what lets the handler leave `preventDefault` alone, so Tab and
    // Escape still reach the focus trap and the sheet machinery.
    for (const key of ['Tab', 'Escape', 'Enter', ' ', 'a', 'F5', 'Shift']) {
      expect(dayForKey(key, false, 200, COMMON)).toBeNull();
    }
  });
});

describe('the date as the reader sees it', () => {
  it('names the day and the month', () => {
    // Containment rather than the whole string, so an ICU data update that
    // respells a month or moves a comma does not fail the suite.
    const label = formatDayOfYear(COMMON, dayOfYearForDateKey('2026-08-04'), 'en-GB');
    expect(label).toContain('4');
    expect(label).toContain('August');
  });

  it('names the leap day', () => {
    expect(formatDayOfYear(LEAP, 60, 'en-GB')).toContain('February');
    expect(formatDayOfYear(LEAP, 60, 'en-GB')).toContain('29');
  });

  it('names the day of the month the day number stands for', () => {
    // Whether the label agrees with the calendar is the whole contract, and the
    // ends of the year are where a zone slip would show first. It cannot slip
    // here — `formatDayOfYear` builds a local midnight and reads it back locally,
    // see the note there — so this pins agreement rather than a mechanism.
    for (const key of ['2026-01-01', '2026-12-31', '2026-08-04', '2026-03-01']) {
      const label = formatDayOfYear(COMMON, dayOfYearForDateKey(key), 'en-GB');
      expect(label).toContain(String(Number(key.slice(8, 10))));
    }
    expect(formatDayOfYear(COMMON, 1, 'en-GB')).toContain('January');
    expect(formatDayOfYear(COMMON, 365, 'en-GB')).toContain('December');
  });

  it('names the first of January for every out-of-range day that wraps to it', () => {
    expect(formatDayOfYear(COMMON, 366, 'en-GB')).toBe(formatDayOfYear(COMMON, 1, 'en-GB'));
  });
});

/**
 * The seam this module introduces: a day number chosen by the knob has to be the
 * day the shading pipeline actually samples, including on the two days a year
 * when the zone's offset moves underneath it.
 *
 * Built the way `sun.test.ts` builds its DST block — the expected crossings come
 * from suncalc's own `getTimes` rather than from hardcoded clock times, so the
 * test states a relationship between the two paths instead of pinning a number
 * that a model update would invalidate.
 */
describe('scrubbing onto a DST transition day', () => {
  const PRAGUE = { lat: 50.09, lon: 14.42, tz: 'Europe/Prague' };
  const TOLERANCE_MIN = 1;

  /** Minute of the zone day at which suncalc puts the crossing. */
  function trueCrossing(dateKey: string, direction: 'rise' | 'set'): number {
    const zoneNoon = instantForZoneWallClock(dateKey, 12, 0, PRAGUE.tz);
    const times = getTimes(zoneNoon, PRAGUE.lat, PRAGUE.lon);
    const event = direction === 'rise' ? times.sunrise : times.sunset;
    // Typed nullable because the sun need not cross the horizon at all; Prague
    // is not one of the places where that happens.
    if (event === null) {
      throw new Error(`suncalc reports no ${direction} for this day`);
    }
    const wall = wallClockInZone(event, PRAGUE.tz);
    return wall.hour * 60 + wall.minute;
  }

  const cases: Array<[string, number, string]> = [
    ['spring forward', dayOfYearForDateKey('2026-03-29'), '2026-03-29'],
    ['fall back', dayOfYearForDateKey('2026-10-25'), '2026-10-25'],
    ['no transition', dayOfYearForDateKey('2026-07-27'), '2026-07-27'],
  ];

  for (const [name, day, expectedKey] of cases) {
    it(`selects and shades the right day on ${name}`, () => {
      // The knob's day number names the day everyone else means by it.
      expect(dateKeyForDayOfYear(COMMON, day)).toBe(expectedKey);
      expect(dayOfYearForDateKey(expectedKey)).toBe(day);

      // A knob landing on that angle really lands on that day.
      expect(dayOfYearForAngle(angleForDayOfYear(day, 365), 365)).toBe(day);

      // And the shading computed from it turns where the sun actually crosses.
      const key = dateKeyForDayOfYear(COMMON, day);
      const { sunrise, sunset } = sunEvents(sampleDay(key, PRAGUE.lat, PRAGUE.lon, PRAGUE.tz).altitudes);
      expect(sunrise).not.toBeNull();
      expect(sunset).not.toBeNull();
      expect(Math.abs((sunrise as number) - trueCrossing(key, 'rise'))).toBeLessThanOrEqual(TOLERANCE_MIN);
      expect(Math.abs((sunset as number) - trueCrossing(key, 'set'))).toBeLessThanOrEqual(TOLERANCE_MIN);
    });
  }

  it('still samples the last wall-clock hour of the 25-hour day', () => {
    // The fall-back day has an hour that happens twice, and an earlier bug
    // sampled by elapsed time and so never reached its last wall-clock hour.
    // Arriving at the day from the knob rather than from `now` must not change
    // that, so the check is repeated here on the knob's own route in.
    const key = dateKeyForDayOfYear(COMMON, dayOfYearForDateKey('2026-10-25'));
    const { altitudes } = sampleDay(key, PRAGUE.lat, PRAGUE.lon, PRAGUE.tz);
    expect(Number.isFinite(altitudes[sampleIndexForHour(23.5)])).toBe(true);
    // Late October in Prague: the sun is well down by 23:30 whichever of the two
    // 02:00s the day resolved, so a sample left at its initial zero would show.
    expect(altitudes[sampleIndexForHour(23.5)]).toBeLessThan(0);
  });
});
