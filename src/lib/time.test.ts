import { describe, expect, it } from 'vitest';
import {
  dateKeyInZone,
  formatDuration,
  formatMinutesOfDay,
  hoursSinceMidnightInZone,
  instantForZoneWallClock,
  minutesFromTimeValue,
  wallClockInZone,
  zoneOffsetMinutes,
} from './time';

/**
 * Every fixture uses an absolute UTC instant and asserts the wall clock in an
 * explicit zone, so nothing here depends on the test runner's own zone (pinned
 * to Europe/Prague in vite.config.ts) — that independence is the point of the
 * module.
 */

describe('zoneOffsetMinutes', () => {
  it('reports whole-hour and fractional offsets', () => {
    const winter = new Date('2026-01-15T12:00:00Z');
    const summer = new Date('2026-07-15T12:00:00Z');
    expect(zoneOffsetMinutes('UTC', winter)).toBe(0);
    expect(zoneOffsetMinutes('Asia/Kathmandu', winter)).toBe(345);
    expect(zoneOffsetMinutes('America/New_York', winter)).toBe(-300);
    expect(zoneOffsetMinutes('America/New_York', summer)).toBe(-240);
  });

  it('returns null for an unknown zone', () => {
    expect(zoneOffsetMinutes('Not/AZone', new Date('2026-01-15T12:00:00Z'))).toBeNull();
  });
});

describe('wallClockInZone', () => {
  it('reads the wall clock of an instant in a given zone', () => {
    const instant = new Date('2026-01-15T12:00:00Z');
    expect(wallClockInZone(instant, 'UTC')).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 12,
      minute: 0,
      second: 0,
    });
    expect(wallClockInZone(instant, 'Asia/Kathmandu')).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 17,
      minute: 45,
      second: 0,
    });
    expect(wallClockInZone(instant, 'America/New_York')).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 7,
      minute: 0,
      second: 0,
    });
  });

  it('crosses the date line without touching the device zone', () => {
    const instant = new Date('2026-01-15T23:30:00Z');
    expect(wallClockInZone(instant, 'Asia/Tokyo')).toEqual({
      year: 2026,
      month: 1,
      day: 16,
      hour: 8,
      minute: 30,
      second: 0,
    });
    expect(wallClockInZone(instant, 'America/New_York')).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 18,
      minute: 30,
      second: 0,
    });
  });

  it('keeps midnight as hour 0, not 24', () => {
    const instant = new Date('2026-01-16T00:00:00Z');
    expect(wallClockInZone(instant, 'UTC').hour).toBe(0);
  });

  it('reports seconds and year-end rollover', () => {
    const instant = new Date('2026-12-31T23:59:59Z');
    expect(wallClockInZone(instant, 'UTC')).toEqual({
      year: 2026,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
      second: 59,
    });
    expect(wallClockInZone(instant, 'Asia/Tokyo').year).toBe(2027);
  });
});

describe('dateKeyInZone', () => {
  it('formats the zone-local date zero-padded', () => {
    const instant = new Date('2026-01-15T23:30:00Z');
    expect(dateKeyInZone(instant, 'Asia/Tokyo')).toBe('2026-01-16');
    expect(dateKeyInZone(instant, 'America/New_York')).toBe('2026-01-15');
    expect(dateKeyInZone(new Date('2026-07-04T05:00:00Z'), 'UTC')).toBe('2026-07-04');
  });
});

describe('instantForZoneWallClock', () => {
  it('inverts wallClockInZone for ordinary times', () => {
    expect(instantForZoneWallClock('2026-07-04', 12, 30, 'America/New_York')).toEqual(new Date('2026-07-04T16:30:00Z'));
    expect(instantForZoneWallClock('2026-01-15', 17, 45, 'Asia/Kathmandu')).toEqual(new Date('2026-01-15T12:00:00Z'));
    expect(instantForZoneWallClock('2026-01-15', 0, 0, 'UTC')).toEqual(new Date('2026-01-15T00:00:00Z'));
  });

  it('round-trips through wallClockInZone across many zones and dates', () => {
    const zones = ['UTC', 'Asia/Kathmandu', 'America/New_York', 'Pacific/Auckland'];
    const cases: Array<[string, number, number]> = [
      ['2026-03-15', 0, 0],
      ['2026-06-21', 13, 7],
      ['2026-12-31', 23, 59],
    ];
    for (const tz of zones) {
      for (const [key, hour, minute] of cases) {
        const instant = instantForZoneWallClock(key, hour, minute, tz);
        const wall = wallClockInZone(instant, tz);
        expect(dateKeyInZone(instant, tz)).toBe(key);
        expect([wall.hour, wall.minute]).toEqual([hour, minute]);
      }
    }
  });

  it('lands deterministically near a spring-forward gap', () => {
    // Prague 2026-03-29: 02:00 CET jumps to 03:00 CEST, so 02:30 never exists
    // on that wall clock. The two-pass offset correction settles on the
    // pre-transition offset, mapping the phantom 02:30 to 01:30Z — 03:30 CEST,
    // one hour late on the dial cell for an hour that never happened.
    const instant = instantForZoneWallClock('2026-03-29', 2, 30, 'Europe/Prague');
    expect(instant).toEqual(new Date('2026-03-29T01:30:00Z'));
  });

  it('picks one of the two instants of a fall-back overlap', () => {
    // Prague 2026-10-25: 03:00 CEST falls back to 02:00 CET, so 02:30 happens
    // twice — at 00:30Z and 01:30Z. The correction converges on the later one.
    const instant = instantForZoneWallClock('2026-10-25', 2, 30, 'Europe/Prague');
    expect([new Date('2026-10-25T00:30:00Z').getTime(), new Date('2026-10-25T01:30:00Z').getTime()]).toContain(
      instant.getTime(),
    );
    const wall = wallClockInZone(instant, 'Europe/Prague');
    expect([wall.hour, wall.minute]).toEqual([2, 30]);
  });
});

describe('hoursSinceMidnightInZone', () => {
  it('converts a zone wall time to fractional hours', () => {
    expect(hoursSinceMidnightInZone(new Date('2026-07-04T16:30:00Z'), 'America/New_York')).toBeCloseTo(12.5, 9);
    expect(hoursSinceMidnightInZone(new Date('2026-01-15T12:00:00Z'), 'Asia/Kathmandu')).toBeCloseTo(17.75, 9);
    expect(hoursSinceMidnightInZone(new Date('2026-01-15T00:00:00Z'), 'UTC')).toBeCloseTo(0, 9);
  });

  it('approaches 24 just before the zone midnight', () => {
    expect(hoursSinceMidnightInZone(new Date('2026-01-15T23:59:59.999Z'), 'UTC')).toBeCloseTo(24, 4);
  });
});

describe('formatMinutesOfDay', () => {
  it('pads both fields to two digits', () => {
    expect(formatMinutesOfDay(0)).toBe('00:00');
    expect(formatMinutesOfDay(9 * 60 + 5)).toBe('09:05');
    expect(formatMinutesOfDay(23 * 60 + 59)).toBe('23:59');
  });

  it('rounds fractional minutes to the nearest', () => {
    // sunEvents returns an interpolated crossing, not a whole minute.
    expect(formatMinutesOfDay(312.4)).toBe('05:12');
    expect(formatMinutesOfDay(312.6)).toBe('05:13');
  });

  it('wraps rather than reading 24:00', () => {
    // Rounding up inside the last minute of the day produces 1440, which names
    // the next midnight; `24:00` on a 24-hour dial would be a second name for
    // the same position.
    expect(formatMinutesOfDay(1439.7)).toBe('00:00');
    expect(formatMinutesOfDay(1440)).toBe('00:00');
  });
});

describe('minutesFromTimeValue', () => {
  it('reads what a time input holds', () => {
    expect(minutesFromTimeValue('00:00')).toBe(0);
    expect(minutesFromTimeValue('09:05')).toBe(545);
    expect(minutesFromTimeValue('23:59')).toBe(1439);
  });

  it('round-trips through formatMinutesOfDay', () => {
    // The marker editor relies on the pair: minutes out to fill the control,
    // minutes back in when it changes.
    for (const minutes of [0, 1, 545, 720, 1439]) {
      expect(minutesFromTimeValue(formatMinutesOfDay(minutes))).toBe(minutes);
    }
  });

  it('accepts the seconds some browsers emit, and drops them', () => {
    expect(minutesFromTimeValue('09:05:00')).toBe(545);
    expect(minutesFromTimeValue('09:05:30.500')).toBe(545);
  });

  it('refuses an empty value rather than reading it as midnight', () => {
    // An empty second time input is how the editor says "this is a moment, not
    // an interval". Read as 0 it would turn every unfinished row into an
    // interval ending at midnight.
    expect(minutesFromTimeValue('')).toBeNull();
  });

  it('refuses anything that is not a time', () => {
    for (const value of ['9', '9:5', '24:00', '12:60', 'noon', '12:00pm', '-1:00']) {
      expect(minutesFromTimeValue(value), value).toBeNull();
    }
  });
});

describe('formatDuration', () => {
  it('counts minutes under the hour', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
  });

  it('drops the minutes on a whole hour', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(720)).toBe('12h');
  });

  it('names both parts otherwise', () => {
    expect(formatDuration(105)).toBe('1h 45m');
    expect(formatDuration(1439)).toBe('23h 59m');
  });

  it('clamps a negative span to nothing', () => {
    expect(formatDuration(-5)).toBe('0m');
  });
});
