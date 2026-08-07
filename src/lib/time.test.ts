import { describe, expect, it } from 'vitest';
import {
  clockText,
  dateKeyInZone,
  formatClockTime,
  formatDialDate,
  formatDuration,
  formatMinutesOfDay,
  formatSpokenDate,
  hoursSinceMidnightInZone,
  instantForZoneWallClock,
  instantForZoneWallClockWith,
  minutesFromTimeValue,
  offsetAtFromTimeline,
  offsetTimelineForDay,
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

/**
 * The equivalence that licenses the offset-timeline fast path.
 *
 * `sampleDay` no longer asks `Intl` for an offset per sample; it builds one
 * timeline per day and reads offsets out of it. That is a rewrite of the hottest
 * arithmetic in the app, sitting exactly where commit 172c4d1's ring-rotation bug
 * lived, so it is not enough for the fast path to look right — it has to be
 * provably the same function. These tests are that proof, and they are cheap.
 *
 * The zone list is chosen for the things that break naive offset handling: a
 * 30-minute DST shift, a quarter-hour offset, a transition at local midnight, the
 * far ends of the offset range, and a zone with no DST at all.
 */
describe('the offset timeline reproduces the slow path exactly', () => {
  const ZONES = [
    'Europe/Prague',
    'America/New_York',
    'Australia/Lord_Howe',
    'Pacific/Chatham',
    'America/Havana',
    'Asia/Kathmandu',
    'Pacific/Kiritimati',
    'UTC',
  ];

  const DAYS = [
    '2026-01-01',
    '2026-03-08',
    '2026-03-29',
    '2026-06-15',
    '2026-10-25',
    '2026-11-01',
    '2026-12-31',
    '2025-12-31',
    '2024-02-29',
  ];

  for (const timeZone of ZONES) {
    it(`agrees to the millisecond for every minute of every day, in ${timeZone}`, () => {
      for (const dateKey of DAYS) {
        const timeline = offsetTimelineForDay(dateKey, timeZone);
        expect(timeline).not.toBeNull();

        for (let minute = 0; minute < 1440; minute += 1) {
          const hour = Math.floor(minute / 60);
          const inMinute = minute % 60;
          const fast = instantForZoneWallClockWith(timeline, dateKey, hour, inMinute, timeZone);
          const slow = instantForZoneWallClock(dateKey, hour, inMinute, timeZone);
          if (fast.getTime() !== slow.getTime()) {
            // Named rather than left as a bare number mismatch: this is the one
            // assertion whose failure means the dial may be an hour out.
            throw new Error(
              `${timeZone} ${dateKey} ${String(hour).padStart(2, '0')}:${String(inMinute).padStart(2, '0')} — ` +
                `fast ${fast.toISOString()} vs slow ${slow.toISOString()}`,
            );
          }
        }
      }
    });
  }
});

describe('offsetTimelineForDay', () => {
  it('finds no change in a zone that does not observe DST', () => {
    for (const timeZone of ['UTC', 'Asia/Tokyo', 'Asia/Kathmandu']) {
      expect(offsetTimelineForDay('2026-06-15', timeZone)?.changes).toEqual([]);
    }
  });

  it('finds the spring-forward transition to the minute', () => {
    // Prague springs forward at 02:00 local on 2026-03-29, which is 01:00 UTC.
    const timeline = offsetTimelineForDay('2026-03-29', 'Europe/Prague');
    expect(timeline?.changes).toEqual([{ at: Date.UTC(2026, 2, 29, 1, 0), offset: 120 }]);
  });

  it('finds the fall-back transition to the minute', () => {
    // And back at 03:00 local on 2026-10-25, which is again 01:00 UTC.
    const timeline = offsetTimelineForDay('2026-10-25', 'Europe/Prague');
    expect(timeline?.changes).toEqual([{ at: Date.UTC(2026, 9, 25, 1, 0), offset: 60 }]);
  });

  it('finds a transition that lands on local midnight', () => {
    // Havana moves its clock at 00:00 local, the case where the transition sits
    // exactly on a day boundary rather than inside the day.
    const timeline = offsetTimelineForDay('2026-03-08', 'America/Havana');
    expect(timeline?.changes).toHaveLength(1);
    expect(timeline?.changes[0].offset).toBe(-240);
  });

  it('finds a half-hour shift', () => {
    // Lord Howe moves by 30 minutes, not 60 — a step a whole-hour assumption
    // would either miss or misplace.
    const timeline = offsetTimelineForDay('2026-04-05', 'Australia/Lord_Howe');
    expect(timeline?.changes).toHaveLength(1);
    expect(timeline?.changes[0].offset).toBe(630);
  });

  it('gives up on an unknown zone rather than guessing', () => {
    expect(offsetTimelineForDay('2026-06-15', 'Not/AZone')).toBeNull();
  });

  it('falls back to the slow path when it cannot answer', () => {
    // A null timeline has to degrade to today's behaviour exactly, including the
    // unknown-zone case where that behaviour is "read the guess as UTC".
    for (const timeZone of ['Europe/Prague', 'Not/AZone']) {
      expect(instantForZoneWallClockWith(null, '2026-06-15', 5, 30, timeZone).getTime()).toBe(
        instantForZoneWallClock('2026-06-15', 5, 30, timeZone).getTime(),
      );
    }
  });
});

describe('offsetAtFromTimeline', () => {
  const timeline = offsetTimelineForDay('2026-03-29', 'Europe/Prague');

  it('reads the offset either side of a change', () => {
    const change = Date.UTC(2026, 2, 29, 1, 0);
    expect(offsetAtFromTimeline(timeline!, change - 60_000)).toBe(60);
    // The change instant itself already reads the new offset.
    expect(offsetAtFromTimeline(timeline!, change)).toBe(120);
    expect(offsetAtFromTimeline(timeline!, change + 60_000)).toBe(120);
  });

  it('refuses instants outside its window', () => {
    expect(offsetAtFromTimeline(timeline!, timeline!.from - 1)).toBeNull();
    expect(offsetAtFromTimeline(timeline!, timeline!.to + 1)).toBeNull();
    expect(offsetAtFromTimeline(timeline!, timeline!.from)).toBe(timeline!.base);
  });

  it('covers every instant the day’s samples can reach', () => {
    // The window has to hold both probes for every minute of the day, or the
    // fast path silently degrades to the slow one for part of the dial.
    for (const minute of [0, 719, 1439]) {
      const guess = Date.UTC(2026, 2, 29, Math.floor(minute / 60), minute % 60);
      const first = offsetAtFromTimeline(timeline!, guess);
      expect(first).not.toBeNull();
      expect(offsetAtFromTimeline(timeline!, guess - (first as number) * 60_000)).not.toBeNull();
    }
  });
});

describe('formatClockTime', () => {
  it('pads to a fixed five glyphs on a 24-hour clock', () => {
    // Fixed width is why the block never reflows: the dial is 24-hour, so this
    // is the default and the one that has to hold still.
    expect(formatClockTime(0, false)).toEqual({ text: '00:00', meridiem: null });
    expect(formatClockTime(9 * 60 + 5, false)).toEqual({ text: '09:05', meridiem: null });
    expect(formatClockTime(23 * 60 + 59, false)).toEqual({ text: '23:59', meridiem: null });
  });

  it('returns the meridiem apart from the digits', () => {
    // Apart, because `DigitalReadout` sets it at a fifth the height. A single
    // string would have to be re-split by the component to draw it.
    expect(formatClockTime(10 * 60 + 44, true)).toEqual({ text: '10:44', meridiem: 'AM' });
    expect(formatClockTime(18 * 60 + 7, true)).toEqual({ text: '6:07', meridiem: 'PM' });
  });

  it('calls midnight and noon twelve, not zero', () => {
    // The two cases a naive `hour % 12` gets wrong, and the reason this
    // conversion is written out rather than left to `Intl`.
    expect(formatClockTime(0, true)).toEqual({ text: '12:00', meridiem: 'AM' });
    expect(formatClockTime(12 * 60, true)).toEqual({ text: '12:00', meridiem: 'PM' });
    expect(formatClockTime(12 * 60 + 30, true)).toEqual({ text: '12:30', meridiem: 'PM' });
    expect(formatClockTime(11 * 60 + 59, true)).toEqual({ text: '11:59', meridiem: 'AM' });
  });

  it('drops the leading zero from a 12-hour hour', () => {
    // Convention, and the reason the 12-hour block is one glyph narrower for
    // part of the day — see the note on `VISUAL.digital.time`.
    expect(formatClockTime(9 * 60 + 5, true)).toEqual({ text: '9:05', meridiem: 'AM' });
  });

  it('wraps a rounded-up 1440 to the next day rather than reading 24:00', () => {
    // Same wrap `formatMinutesOfDay` does, and for the same reason: 23:59:40
    // rounds to minute 1440.
    expect(formatClockTime(1439.7, false)).toEqual({ text: '00:00', meridiem: null });
    expect(formatClockTime(1440, true)).toEqual({ text: '12:00', meridiem: 'AM' });
    expect(formatClockTime(-1, false)).toEqual({ text: '23:59', meridiem: null });
  });
});

describe('clockText', () => {
  it('joins the parts for the places that speak the time rather than draw it', () => {
    expect(clockText({ text: '10:44', meridiem: null })).toBe('10:44');
    expect(clockText({ text: '10:44', meridiem: 'AM' })).toBe('10:44 AM');
  });
});

describe('formatDialDate', () => {
  // 14:00 in Prague on Thursday the 6th; 02:00 on Friday the 7th in Auckland,
  // which is UTC+12 in August. One instant, two dates — the whole point of the
  // line, since the dial runs on the chosen place's clock and not the device's.
  const instant = new Date('2026-08-06T12:00:00Z');

  it('names the date in the dial zone, not the device zone', () => {
    expect(formatDialDate(instant, 'Europe/Prague')).not.toBe(formatDialDate(instant, 'Pacific/Auckland'));
  });

  it('carries the day of the month the dial zone is on', () => {
    // Asserting the day number rather than the whole string: the order of the
    // parts is the reader's locale's business, not ours, and pinning it here
    // would fail on any CI box with a different default.
    expect(formatDialDate(instant, 'Europe/Prague')).toContain('6');
    expect(formatDialDate(instant, 'Pacific/Auckland')).toContain('7');
  });

  it('applies the zone offset across midnight', () => {
    // 22:30 UTC is already 00:30 the next day in Prague. Read in UTC, or with
    // the offset dropped, this lands on the 24th and the hub would show
    // yesterday for two hours every night.
    expect(formatDialDate(new Date('2026-10-24T22:30:00Z'), 'Europe/Prague')).toContain('25');
  });
});

describe('formatSpokenDate', () => {
  it('writes the weekday and month out in full', () => {
    // The dial is `role="img"`, so its accessible name is the only route this
    // date has to a screen reader — and an abbreviation that reads well on a
    // 5.5-unit line does not read well aloud.
    const spoken = formatSpokenDate(new Date('2026-08-06T12:00:00Z'), 'Europe/Prague');
    expect(spoken.length).toBeGreaterThan(formatDialDate(new Date('2026-08-06T12:00:00Z'), 'Europe/Prague').length);
  });

  it('agrees with the drawn date about which day it is', () => {
    const instant = new Date('2026-08-06T12:00:00Z');
    expect(formatSpokenDate(instant, 'Pacific/Auckland')).toContain('7');
  });
});
