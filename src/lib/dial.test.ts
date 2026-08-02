import { describe, expect, it } from 'vitest';
import { daylightArcs, sampleIndexForHour } from './dial';
import { angleForHour } from './geometry';
import { SAMPLES_PER_DAY, sampleDay, sunEvents } from './sun';

describe('sampleIndexForHour', () => {
  it('maps midnight to the first sample', () => {
    expect(sampleIndexForHour(0)).toBe(0);
  });

  it('maps noon to the middle sample', () => {
    expect(sampleIndexForHour(12)).toBe(SAMPLES_PER_DAY / 2);
  });

  it('wraps the end of the day back to the first sample', () => {
    expect(sampleIndexForHour(24)).toBe(0);
  });

  it('stays in range for every hour of the day', () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const index = sampleIndexForHour(hour);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(SAMPLES_PER_DAY);
      expect(Number.isInteger(index)).toBe(true);
    }
  });
});

/**
 * Driven through the real `sampleDay` → `sunEvents` pipeline rather than from
 * hand-written `SunEvents` literals, so these cross the module boundary the way
 * AGENTS.md asks: a fixture that stopped producing the shape it is named for
 * would fail here instead of quietly testing a case that no longer occurs.
 *
 * The sites and dates are not invented. They were found by scanning 2026 for
 * days where the interpolated sunset precedes the interpolated sunrise; that
 * scan is also how to refresh them if suncalc's model ever moves.
 */
describe('daylightArcs', () => {
  const PRAGUE = { lat: 50.09, lon: 14.42, tz: 'Europe/Prague' };
  /** Svalbard — far enough north for both polar day and polar night. */
  const LONGYEARBYEN = { lat: 78.22, lon: 15.65, tz: 'Europe/Prague' };
  /** Reykjavík — 12 days in 2026 where daylight wraps midnight. */
  const REYKJAVIK = { lat: 64.13, lon: -21.9, tz: 'Atlantic/Reykjavik' };

  const eventsFor = (dateKey: string, site: typeof PRAGUE) =>
    sunEvents(sampleDay(dateKey, site.lat, site.lon, site.tz).altitudes);

  it('gives an ordinary day one span, ending where sunEvents says', () => {
    const events = eventsFor('2026-07-27', PRAGUE);
    expect(daylightArcs(events)).toEqual([{ from: events.sunrise, to: events.sunset }]);
  });

  it('gives polar day the whole ring and polar night nothing', () => {
    // Asserted through the pipeline so the fixtures stay honest: these are the
    // same two dates `sun.test.ts` uses for polar day and polar night.
    expect(eventsFor('2026-06-21', LONGYEARBYEN).polar).toBe('day');
    expect(daylightArcs(eventsFor('2026-06-21', LONGYEARBYEN))).toBe('full');

    expect(eventsFor('2026-12-21', LONGYEARBYEN).polar).toBe('night');
    expect(daylightArcs(eventsFor('2026-12-21', LONGYEARBYEN))).toBeNull();
  });

  it('splits a day whose daylight wraps midnight into two spans', () => {
    // Reykjavík, 17 June 2026: the sun sets at 00:01 and rises again at 02:56,
    // so sunset PRECEDES sunrise and daylight occupies both ends of the dial.
    // Returned in order it would be sunrise=176 → sunset=1, which sweeps
    // backwards through `sectorPath` and fills the night instead.
    const events = eventsFor('2026-06-17', REYKJAVIK);
    expect(events.polar).toBeNull();
    expect(events.sunrise).not.toBeNull();
    expect(events.sunset).not.toBeNull();
    expect(events.sunrise!).toBeGreaterThan(events.sunset!);

    expect(daylightArcs(events)).toEqual([
      { from: 0, to: events.sunset },
      { from: events.sunrise, to: 1440 },
    ]);
  });

  it('clamps a missing crossing to the day boundary', () => {
    // Hand-built, because the boundary days that produce exactly one crossing
    // are the pathological ones `sunEvents` documents rather than a stable
    // fixture: what matters here is which end gets clamped.
    expect(daylightArcs({ sunrise: null, sunset: 300, polar: null })).toEqual([{ from: 0, to: 300 }]);
    expect(daylightArcs({ sunrise: 300, sunset: null, polar: null })).toEqual([{ from: 300, to: 1440 }]);
  });

  it('never produces a span outside the day, or one that runs backwards', () => {
    // Swept across a year at three latitudes rather than spot-checked: every
    // shape this function can return has to be drawable, and a backwards span
    // is exactly the bug the wrap-midnight case would have introduced.
    for (const site of [PRAGUE, REYKJAVIK, LONGYEARBYEN]) {
      for (let day = 1; day <= 365; day += 7) {
        const date = new Date(Date.UTC(2026, 0, day));
        const spans = daylightArcs(eventsFor(date.toISOString().slice(0, 10), site));
        if (spans === 'full' || spans === null) {
          continue;
        }
        for (const { from, to } of spans) {
          expect(from).toBeGreaterThanOrEqual(0);
          expect(to).toBeLessThanOrEqual(1440);
          expect(to).toBeGreaterThan(from);
        }
      }
    }
  });

  it('maps span minutes onto dial angles through the shared helper', () => {
    // The seam between this module and `geometry.ts`: a span in minutes only
    // means anything once it becomes an angle, and midnight has to land at the
    // bottom of the dial in both directions.
    expect(angleForHour(0 / 60)).toBe(-180);
    expect(angleForHour(720 / 60)).toBe(0);
    expect(angleForHour(1440 / 60)).toBe(180);
  });
});
