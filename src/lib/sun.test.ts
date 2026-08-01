import { getPosition, getTimes } from 'suncalc';
import { describe, expect, it } from 'vitest';
import { sampleIndexForHour } from './dial';
import { altitudeToLightness, HORIZON_DEG } from './lightness';
import { MINUTES_PER_SAMPLE, SAMPLES_PER_DAY, sampleDay, sunEvents } from './sun';
import { instantForZoneWallClock, wallClockInZone } from './time';

/**
 * Index of the sample covering a given **wall-clock** hour of the sampled
 * zone's day. `sampleDay` guarantees sample `i` is wall-clock minute `i` of
 * the day in the zone it was given — the zone is now an explicit argument, so
 * fixtures name their zone instead of inheriting the test runner's (pinned to
 * `Europe/Prague` in vite.config.ts; several fixtures below deliberately use
 * other zones to prove the device zone no longer matters).
 */
const sampleAt = (wallHour: number) => (wallHour * 60) / MINUTES_PER_SAMPLE;

describe('HORIZON_DEG', () => {
  it('is the apparent altitude suncalc puts its own sunrise and sunset at', () => {
    // The whole point of the constant, and the one thing worth pinning about
    // it: `getPosition` reports *apparent* (refraction-corrected) altitude, so
    // the threshold to compare it against is not the familiar geometric
    // -0.833°. Read off suncalc rather than recomputed here — the constant's
    // doc comment derives it from Meeus 16.4, and this is the check that the
    // derivation matches what suncalc actually does.
    //
    // Latitude-independent, so three widely separated sites prove it is a
    // property of the model and not a mid-latitude coincidence.
    for (const [lat, lon] of [
      [50.09, 14.42],
      [1.35, 103.82],
      [64.13, -21.9],
    ] as const) {
      const times = getTimes(new Date(Date.UTC(2026, 2, 20, 12)), lat, lon);
      for (const event of [times.sunrise, times.sunset]) {
        expect(event).not.toBeNull();
        expect(getPosition(event!, lat, lon).altitude).toBeCloseTo(HORIZON_DEG, 3);
      }
    }
  });
});

describe('sampleDay', () => {
  it('covers the day at the declared resolution', () => {
    const profile = sampleDay('2026-06-21', 50.45, 30.52, 'Europe/Prague');
    expect(profile.altitudes).toHaveLength(SAMPLES_PER_DAY);
    expect(profile.lightness).toHaveLength(SAMPLES_PER_DAY);
    expect((SAMPLES_PER_DAY * MINUTES_PER_SAMPLE) / 60).toBe(24);
  });

  it('places sample i at wall-clock minute i of the zone day', () => {
    // The invariant `sampleIndexForHour` depends on, asserted directly and on
    // both DST transition days, where indexing by elapsed time would drift an
    // hour. `Europe/Prague` matches the pinned test zone, so candidate
    // instants can be built with the plain local Date constructor. During the
    // fall-back overlap a wall-clock minute names two instants an hour apart
    // — the JS Date constructor takes the earlier, `sampleDay` the later —
    // so the assertion is "matches *an* instant that reads minute i", exact
    // for the unambiguous 1437 minutes of a normal day. A spring-forward gap
    // minute names no instant at all; there `sampleDay` documents landing an
    // hour off the phantom time, and only there is a ±1 h reading accepted.
    for (const [key, y, m, d] of [
      ['2026-07-27', 2026, 6, 27],
      ['2026-03-29', 2026, 2, 29],
      ['2026-10-25', 2026, 9, 25],
    ] as const) {
      const { altitudes } = sampleDay(key, 50.09, 14.42, 'Europe/Prague');
      for (const minute of [0, 1, 137, 500, 1439]) {
        const naive = new Date(y, m, d, 0, minute).getTime();
        const readsMinute = (instant: Date, wantedMinute: number): boolean => {
          const wall = wallClockInZone(instant, 'Europe/Prague');
          return (
            wall.year === y && wall.month === m + 1 && wall.day === d && wall.hour * 60 + wall.minute === wantedMinute
          );
        };
        const nearby = [naive, naive - 3_600_000, naive + 3_600_000].map((ms) => new Date(ms));
        let candidates = nearby.filter((instant) => readsMinute(instant, minute));
        if (candidates.length === 0) {
          // Phantom (gap) minute: no instant reads it. Accept the two wall
          // clocks an hour to either side of it instead.
          candidates = nearby.filter(
            (instant) => readsMinute(instant, minute - 60) || readsMinute(instant, minute + 60),
          );
        }
        expect(candidates.length).toBeGreaterThan(0);
        const closest = Math.min(
          ...candidates.map((instant) => Math.abs(altitudes[minute] - getPosition(instant, 50.09, 14.42).altitude)),
        );
        expect(closest).toBeLessThan(5e-13);
      }
    }
  });

  it('samples in the requested zone, not the device zone', () => {
    // Kathmandu is UTC+5:45 — no sample of its day can coincide with a Prague
    // wall-clock minute. Expected altitude computed at the absolute instant of
    // Kathmandu noon, independent of any zone's wall clock.
    const { altitudes } = sampleDay('2026-01-15', 27.72, 85.32, 'Asia/Kathmandu');
    const kathmanduNoon = new Date('2026-01-15T06:15:00Z');
    expect(altitudes[sampleAt(12)]).toBeCloseTo(getPosition(kathmanduNoon, 27.72, 85.32).altitude, 12);
  });

  it('matches known solar altitudes', () => {
    // Values produced by suncalc 2.0.1 itself, at the given wall-clock hour of
    // the given Prague day; they anchor the wiring, not the astronomy.
    // Degrees, not radians.
    const kyivJune = sampleDay('2026-06-21', 50.45, 30.52, 'Europe/Prague');
    expect(kyivJune.altitudes[sampleAt(9)]).toBeCloseTo(46.0967, 3);

    const kyivDec = sampleDay('2026-12-21', 50.45, 30.52, 'Europe/Prague');
    expect(kyivDec.altitudes[sampleAt(9)]).toBeCloseTo(11.871, 3);

    const quito = sampleDay('2026-03-20', -0.18, -78.47, 'Europe/Prague');
    expect(quito.altitudes[sampleAt(17)]).toBeCloseTo(69.6808, 3);

    const sydney = sampleDay('2026-01-15', -33.87, 151.21, 'Europe/Prague');
    expect(sydney.altitudes[sampleAt(2)]).toBeCloseTo(70.9285, 3);
  });

  it('reports polar day as an all-positive profile', () => {
    const { altitudes } = sampleDay('2026-06-21', 78.22, 15.65, 'Europe/Prague');
    expect(Math.min(...altitudes)).toBeGreaterThan(0);
  });

  it('reports polar night as an all-negative profile', () => {
    const { altitudes } = sampleDay('2026-12-21', 78.22, 15.65, 'Europe/Prague');
    expect(Math.max(...altitudes)).toBeLessThan(0);
  });

  it('derives lightness from altitude through the shared ramp', () => {
    const { altitudes, lightness } = sampleDay('2026-06-21', 50.45, 30.52, 'Europe/Prague');
    for (let i = 0; i < SAMPLES_PER_DAY; i += 37) {
      expect(lightness[i]).toBeCloseTo(altitudeToLightness(altitudes[i]), 12);
    }
  });

  it('gives a polar-night dial no daylight samples', () => {
    const { altitudes, lightness } = sampleDay('2026-12-21', 78.22, 15.65, 'Europe/Prague');
    // The sun stays below the civil-twilight boundary all day, so no part of
    // the dial reaches even the civil anchor's brightness. Expressed against
    // the anchor rather than a magic tolerance: the real brightest sample sits
    // at roughly 0.356, and a hand-picked bound near that is fragile.
    expect(Math.max(...altitudes)).toBeLessThan(-6);
    expect(Math.max(...lightness)).toBeLessThan(altitudeToLightness(-6));
  });
});

/**
 * The pair no other test composes: `sampleDay` produces the profile, and the
 * dial reads it back through `sampleIndexForHour`. If the two disagree about
 * what a sample index means, the whole ring is rotated away from the hands —
 * which is exactly what happened while samples were indexed by elapsed time,
 * on the two days a year when the UTC offset changes mid-day.
 *
 * Run for Prague (the device zone of the test run) and for New York, whose
 * 2026 transitions fall on different days (8 March / 1 November vs 29 March /
 * 25 October) — if anything in the pipeline still consulted the device zone,
 * the New York cases would be an hour out on exactly those days.
 */
describe('sampleDay composed with sampleIndexForHour', () => {
  /**
   * One minute, which is the sampling resolution — `dialCrossing` reads a whole
   * sample index rather than interpolating, so it can only ever be right to the
   * minute.
   *
   * This was 10 min, on the belief that the sampled crossing and suncalc's own
   * `getTimes` "use different solar models" and must differ by a couple of
   * minutes. They do not: both come from the same `getPosition`, and the
   * disagreement was `HORIZON_DEG` double-counting refraction — a flat 3 min at
   * these latitudes, 4.4 min at Reykjavík. The loose tolerance is what let that
   * sit here undetected, so it is deliberately tight now.
   */
  const TOLERANCE_MIN = 1;

  interface Site {
    lat: number;
    lon: number;
    tz: string;
  }

  /** Minute of the zone day at which the dial's shading crosses the horizon. */
  function dialCrossing(dateKey: string, site: Site, direction: 'rise' | 'set'): number {
    const { altitudes } = sampleDay(dateKey, site.lat, site.lon, site.tz);
    for (let minute = 1; minute < 24 * 60; minute += 1) {
      const previous = altitudes[sampleIndexForHour((minute - 1) / 60)];
      const current = altitudes[sampleIndexForHour(minute / 60)];
      const crossed =
        direction === 'rise'
          ? previous < HORIZON_DEG && current >= HORIZON_DEG
          : previous >= HORIZON_DEG && current < HORIZON_DEG;
      if (crossed) {
        return minute;
      }
    }
    throw new Error(`no ${direction} crossing found`);
  }

  /** Minute of the zone day of suncalc's own sunrise/sunset for that day. */
  function trueCrossing(dateKey: string, site: Site, direction: 'rise' | 'set'): number {
    const zoneNoon = instantForZoneWallClock(dateKey, 12, 0, site.tz);
    const times = getTimes(zoneNoon, site.lat, site.lon);
    const event = direction === 'rise' ? times.sunrise : times.sunset;
    // Typed nullable because the sun need not cross the horizon at all; these
    // mid-latitude sites are not among those places.
    if (event === null) {
      throw new Error(`suncalc reports no ${direction} for this day`);
    }
    const wall = wallClockInZone(event, site.tz);
    return wall.hour * 60 + wall.minute;
  }

  const PRAGUE: Site = { lat: 50.09, lon: 14.42, tz: 'Europe/Prague' };
  const NEW_YORK: Site = { lat: 40.71, lon: -74.01, tz: 'America/New_York' };

  const cases: Array<[string, Site, string]> = [
    ['spring forward (Prague)', PRAGUE, '2026-03-29'],
    ['fall back (Prague)', PRAGUE, '2026-10-25'],
    ['no transition (Prague)', PRAGUE, '2026-07-27'],
    ['spring forward (New York)', NEW_YORK, '2026-03-08'],
    ['fall back (New York)', NEW_YORK, '2026-11-01'],
  ];

  for (const [name, site, dateKey] of cases) {
    it(`puts the shading boundary at the true local sunrise and sunset (${name})`, () => {
      for (const direction of ['rise', 'set'] as const) {
        expect(
          Math.abs(dialCrossing(dateKey, site, direction) - trueCrossing(dateKey, site, direction)),
        ).toBeLessThanOrEqual(TOLERANCE_MIN);
      }
    });
  }

  it('samples the last wall-clock hour of a fall-back day', () => {
    // A 25-hour absolute day sampled by elapsed minutes ran out before 23:00
    // local, leaving the final hour of the ring holding the wrong altitude.
    const { altitudes } = sampleDay('2026-10-25', PRAGUE.lat, PRAGUE.lon, PRAGUE.tz);
    const lateEvening = new Date(2026, 9, 25, 23, 30);
    expect(altitudes[sampleIndexForHour(23.5)]).toBeCloseTo(
      getPosition(lateEvening, PRAGUE.lat, PRAGUE.lon).altitude,
      12,
    );
  });
});

describe('sunEvents', () => {
  /**
   * Tighter than the composition suite's minute, because `sunEvents`
   * interpolates between the straddling samples instead of taking one of them:
   * agreement with `getTimes` measured under 0.01 min at every site and season
   * tried. See the note on `TOLERANCE_MIN` above for what the old 10-minute
   * allowance was hiding.
   */
  const TOLERANCE_MIN = 0.1;

  const PRAGUE = { lat: 50.09, lon: 14.42, tz: 'Europe/Prague' };
  /** Svalbard — far enough north for both polar day and polar night. */
  const LONGYEARBYEN = { lat: 78.22, lon: 15.65, tz: 'Europe/Prague' };

  /**
   * Minute of the zone day of suncalc's own event for that day, **fractional**.
   * Seconds are carried rather than truncated: `sunEvents` interpolates to a
   * fraction of a minute, so dropping them would leave up to a minute of
   * comparison error and force a tolerance loose enough to hide a real one.
   */
  function trueMinute(dateKey: string, site: typeof PRAGUE, direction: 'sunrise' | 'sunset'): number {
    const times = getTimes(instantForZoneWallClock(dateKey, 12, 0, site.tz), site.lat, site.lon);
    const event = times[direction];
    if (event === null) {
      throw new Error(`suncalc reports no ${direction} for this day`);
    }
    const wall = wallClockInZone(event, site.tz);
    return wall.hour * 60 + wall.minute + wall.second / 60;
  }

  it('finds both crossings on an ordinary day', () => {
    const { altitudes } = sampleDay('2026-07-27', PRAGUE.lat, PRAGUE.lon, PRAGUE.tz);
    const events = sunEvents(altitudes);

    expect(events.polar).toBeNull();
    expect(events.sunrise).not.toBeNull();
    expect(events.sunset).not.toBeNull();
    expect(events.sunrise!).toBeLessThan(events.sunset!);
    expect(Math.abs(events.sunrise! - trueMinute('2026-07-27', PRAGUE, 'sunrise'))).toBeLessThanOrEqual(TOLERANCE_MIN);
    expect(Math.abs(events.sunset! - trueMinute('2026-07-27', PRAGUE, 'sunset'))).toBeLessThanOrEqual(TOLERANCE_MIN);
  });

  it('interpolates strictly between the samples that straddle the horizon', () => {
    // The tie between the reported time and the ring's own change of shade. A
    // bare sample index would land on one side or the other; the interpolated
    // minute has to sit inside the one-minute window where the crossing
    // actually happens.
    const { altitudes } = sampleDay('2026-07-27', PRAGUE.lat, PRAGUE.lon, PRAGUE.tz);
    const { sunrise, sunset } = sunEvents(altitudes);

    const before = Math.floor(sunrise! / MINUTES_PER_SAMPLE);
    expect(altitudes[before]).toBeLessThanOrEqual(HORIZON_DEG);
    expect(altitudes[before + 1]).toBeGreaterThan(HORIZON_DEG);

    const lastLit = Math.floor(sunset! / MINUTES_PER_SAMPLE);
    expect(altitudes[lastLit]).toBeGreaterThan(HORIZON_DEG);
    expect(altitudes[lastLit + 1]).toBeLessThanOrEqual(HORIZON_DEG);
  });

  it('reports polar day as no crossings on the lit side', () => {
    const { altitudes } = sampleDay('2026-06-21', LONGYEARBYEN.lat, LONGYEARBYEN.lon, LONGYEARBYEN.tz);
    expect(sunEvents(altitudes)).toEqual({ sunrise: null, sunset: null, polar: 'day' });
  });

  it('reports polar night as no crossings on the dark side', () => {
    const { altitudes } = sampleDay('2026-12-21', LONGYEARBYEN.lat, LONGYEARBYEN.lon, LONGYEARBYEN.tz);
    expect(sunEvents(altitudes)).toEqual({ sunrise: null, sunset: null, polar: 'night' });
  });

  it('holds on DST transition days, in the zone the day was sampled for', () => {
    // The seam worth testing: sunEvents reads indices that mean wall-clock
    // minutes only because sampleDay resolves each sample from zone wall-clock
    // components. Index by elapsed time instead and these come out an hour off
    // on exactly these days — New York's transitions fall on different dates
    // from Prague's, so a lingering device-zone dependency shows up here too.
    const NEW_YORK = { lat: 40.71, lon: -74.01, tz: 'America/New_York' };
    const cases: Array<[string, typeof PRAGUE]> = [
      ['2026-03-29', PRAGUE],
      ['2026-10-25', PRAGUE],
      ['2026-03-08', NEW_YORK],
      ['2026-11-01', NEW_YORK],
    ];

    for (const [dateKey, site] of cases) {
      const { altitudes } = sampleDay(dateKey, site.lat, site.lon, site.tz);
      const events = sunEvents(altitudes);
      for (const direction of ['sunrise', 'sunset'] as const) {
        expect(Math.abs(events[direction]! - trueMinute(dateKey, site, direction))).toBeLessThanOrEqual(TOLERANCE_MIN);
      }
    }
  });

  it('orders the crossings correctly south of the equator', () => {
    const sydney = { lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' };
    const { altitudes } = sampleDay('2026-01-15', sydney.lat, sydney.lon, sydney.tz);
    const events = sunEvents(altitudes);
    expect(events.sunrise!).toBeLessThan(events.sunset!);
    expect(Math.abs(events.sunrise! - trueMinute('2026-01-15', sydney, 'sunrise'))).toBeLessThanOrEqual(TOLERANCE_MIN);
  });
});
