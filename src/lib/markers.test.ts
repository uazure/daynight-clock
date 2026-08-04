import { describe, expect, it } from 'vitest';
import {
  isMoment,
  laneBand,
  laneCount,
  MAX_LABEL_LENGTH,
  MAX_MARKERS,
  type Marker,
  markerLanes,
  markerSpans,
  momentPhase,
  nextBoundary,
  parseMarkers,
  readoutLines,
  spanPhase,
} from './markers';
import { VISUAL } from './visual';

const at = (hour: number, minute = 0) => hour * 60 + minute;
const marker = (label: string, start: number, end: number | null = null): Marker => ({ label, start, end });

describe('parsing stored markers', () => {
  it('keeps a well-formed pair of a moment and an interval', () => {
    expect(
      parseMarkers([
        { label: 'Wake', start: 390, end: null },
        { label: 'Work', start: 540, end: 1080 },
      ]),
    ).toEqual([
      { label: 'Wake', start: 390, end: null },
      { label: 'Work', start: 540, end: 1080 },
    ]);
  });

  it('reads anything that is not an array as no markers at all', () => {
    // What a hand-edited storage key, or a key written by a future version,
    // most plausibly looks like.
    for (const raw of [null, undefined, 42, 'markers', {}]) {
      expect(parseMarkers(raw)).toEqual([]);
    }
  });

  it('drops entries with no usable start rather than guessing one', () => {
    // The editor relies on this: a row being typed has an empty start, and it
    // must not appear on the dial as an accidental midnight.
    expect(parseMarkers([null, 'Work', { label: 'Work' }, { start: null }, { start: Number.NaN }])).toEqual([]);
  });

  it('clamps a start into the day and rounds it to a whole minute', () => {
    expect(parseMarkers([{ start: -30 }, { start: 5000 }, { start: 61.6 }])).toEqual([
      { label: '', start: 0, end: null },
      { label: '', start: 1439, end: null },
      { label: '', start: 62, end: null },
    ]);
  });

  it('normalises a zero-length interval to a moment', () => {
    // Otherwise `isMoment` would have to compare the two fields at every call
    // site, and one of them would eventually forget.
    expect(parseMarkers([{ start: 540, end: 540 }])[0].end).toBeNull();
  });

  it('keeps an end before its start, which is how an interval wraps midnight', () => {
    expect(parseMarkers([{ label: 'Sleep', start: 1380, end: 420 }])[0]).toEqual({
      label: 'Sleep',
      start: 1380,
      end: 420,
    });
  });

  it('trims a label and caps its length', () => {
    const [parsed] = parseMarkers([{ label: `  ${'x'.repeat(40)}  `, start: 0 }]);
    expect(parsed.label).toBe('x'.repeat(MAX_LABEL_LENGTH));
  });

  it('truncates at the maximum, whatever storage holds', () => {
    const many = Array.from({ length: MAX_MARKERS + 3 }, (_, i) => ({ start: i * 60 }));
    expect(parseMarkers(many)).toHaveLength(MAX_MARKERS);
  });
});

describe('the spans a marker occupies', () => {
  it('gives a moment none, because it has no arc to sweep', () => {
    const wake = marker('Wake', 390);
    expect(isMoment(wake)).toBe(true);
    expect(markerSpans(wake)).toEqual([]);
  });

  it('gives an ordinary interval one', () => {
    expect(markerSpans(marker('Work', at(9), at(18)))).toEqual([{ from: at(9), to: at(18) }]);
  });

  it('splits an interval that wraps midnight into both ends of the dial', () => {
    // The case that makes this a list: handed to `sectorPath` in the order
    // stored, 23:00→07:00 sweeps backwards and fills the 17 hours the reader is
    // awake instead of the 8 they are not.
    expect(markerSpans(marker('Sleep', at(23), at(7)))).toEqual([
      { from: 0, to: at(7) },
      { from: at(23), to: 1440 },
    ]);
  });

  it('never produces a span covering the whole circle', () => {
    // A 360° `sectorPath` starts and ends at the same point and paints nothing,
    // so a full-day span would silently disappear. The widest a single span can
    // be is 00:00–23:59, and a 24-hour "interval" is a moment by normalisation.
    for (const span of markerSpans(marker('All day', 0, 1439))) {
      expect(span.to - span.from).toBeLessThan(1440);
    }
  });
});

describe('where a span sits relative to now', () => {
  const work = { from: at(9), to: at(18) };

  it('reads as upcoming, active and past across the day', () => {
    expect(spanPhase(work, at(8))).toBe('upcoming');
    expect(spanPhase(work, at(9))).toBe('active');
    expect(spanPhase(work, at(17, 59))).toBe('active');
    expect(spanPhase(work, at(18))).toBe('past');
  });

  it('phases the two halves of a wrapping interval separately', () => {
    // The whole reason this is per span: at noon, "asleep 23:00–07:00" is one
    // span that finished this morning and one that has not started tonight, and
    // no single verdict about the marker could be true of both.
    const [morning, evening] = markerSpans(marker('Sleep', at(23), at(7)));
    expect(spanPhase(morning, at(12))).toBe('past');
    expect(spanPhase(evening, at(12))).toBe('upcoming');
  });

  it('keeps a moment loud for exactly its own minute', () => {
    expect(momentPhase(at(6, 30), at(6, 29))).toBe('upcoming');
    expect(momentPhase(at(6, 30), at(6, 30))).toBe('active');
    expect(momentPhase(at(6, 30), at(6, 31))).toBe('past');
  });
});

describe('the next boundary', () => {
  const wake = marker('Wake', at(6, 30));
  const work = marker('Work', at(9), at(18));

  it('is nothing at all when there are no markers', () => {
    expect(nextBoundary([], at(12))).toBeNull();
  });

  it('prefers the end of an interval in progress over anything later', () => {
    expect(nextBoundary([wake, work], at(12))).toEqual({
      marker: work,
      kind: 'end',
      at: at(18),
      inMinutes: 6 * 60,
    });
  });

  it('wraps into tomorrow rather than running out of day', () => {
    // The failure this prevents: at 23:00 a naive forward scan finds nothing and
    // the readout goes blank for the last hour of every day.
    expect(nextBoundary([wake, work], at(23))).toEqual({
      marker: wake,
      kind: 'start',
      at: at(6, 30),
      inMinutes: 7 * 60 + 30,
    });
  });

  it('counts a boundary in this very minute as the next one', () => {
    // Zero distance is the most imminent there is, not a boundary to skip —
    // skipping it would jump the readout to something 24 hours away.
    expect(nextBoundary([work], at(9))).toMatchObject({ kind: 'start', inMinutes: 0 });
  });

  it('breaks a tie by list order, so the choice is stable across renders', () => {
    const first = marker('First', at(10));
    const second = marker('Second', at(10));
    expect(nextBoundary([first, second], at(9))?.marker).toBe(first);
  });
});

describe('the readout wording', () => {
  const lines = (m: Marker, now: number) => {
    const next = nextBoundary([m], now);
    if (next === null) {
      throw new Error('a single marker always has a next boundary');
    }
    return readoutLines(next);
  };

  it('names an interval in progress by its end', () => {
    expect(lines(marker('Work', at(9), at(18)), at(16, 15))).toEqual({ label: 'Work ends', detail: 'in 1h 45m' });
  });

  it('names an interval that has not started by its start', () => {
    expect(lines(marker('Work', at(9), at(18)), at(8, 30))).toEqual({ label: 'Work starts', detail: 'in 30m' });
  });

  it('names a moment without a verb, there being nothing to begin or finish', () => {
    expect(lines(marker('Wake', at(6, 30)), at(6))).toEqual({ label: 'Wake', detail: 'in 30m' });
  });

  it('falls back to the time when the marker has no name', () => {
    // Which is why a blank label survives parsing: "18:00" is a perfectly good
    // thing for the dial to say, and refusing a countdown until the reader
    // names the row would be a validation error over nothing.
    expect(lines(marker('', at(9), at(18)), at(12)).label).toBe('Ends 18:00');
    expect(lines(marker('', at(9), at(18)), at(8)).label).toBe('Starts 09:00');
    expect(lines(marker('', at(6, 30)), at(6)).label).toBe('06:30');
  });

  it('says "now" rather than "in 0m"', () => {
    expect(lines(marker('Work', at(9), at(18)), at(9)).detail).toBe('now');
  });
});

describe('stacking overlapping markers into lanes', () => {
  it('leaves markers that do not overlap on one lane', () => {
    const lanes = markerLanes([marker('Work', at(9), at(17)), marker('Gym', at(18), at(19))]);
    expect(lanes).toEqual([0, 0]);
    expect(laneCount(lanes)).toBe(1);
  });

  it('puts a break inside work on the lane above it', () => {
    // The case this exists for: the shorter, contained interval goes outward, so
    // it reads as sitting on top of the block it interrupts.
    const lanes = markerLanes([marker('Work', at(9), at(17)), marker('Break', at(12), at(12, 30))]);
    expect(lanes).toEqual([0, 1]);
    expect(laneCount(lanes)).toBe(2);
  });

  it('puts the longest interval innermost whatever order they arrive in', () => {
    // Same two markers, listed the other way round: the lane each gets is decided
    // by its length, not by its position in the array.
    const lanes = markerLanes([marker('Break', at(12), at(12, 30)), marker('Work', at(9), at(17))]);
    expect(lanes).toEqual([1, 0]);
  });

  it('stacks three nested intervals', () => {
    const lanes = markerLanes([
      marker('Day', at(8), at(20)),
      marker('Work', at(9), at(17)),
      marker('Break', at(12), at(12, 30)),
    ]);
    expect(lanes).toEqual([0, 1, 2]);
    expect(laneCount(lanes)).toBe(3);
  });

  it('reuses a lane for intervals that only overlap something else', () => {
    // Two breaks inside one working day do not overlap each other, so they share
    // the lane above it rather than each taking one.
    const lanes = markerLanes([
      marker('Work', at(9), at(17)),
      marker('Lunch', at(12), at(12, 30)),
      marker('Tea', at(15), at(15, 15)),
    ]);
    expect(lanes).toEqual([0, 1, 1]);
    expect(laneCount(lanes)).toBe(2);
  });

  it('treats touching intervals as not overlapping', () => {
    // 09:00–12:00 and 12:00–17:00 share only the instant between them, and a
    // half-open comparison is what keeps them on one lane.
    const lanes = markerLanes([marker('AM', at(9), at(12)), marker('PM', at(12), at(17))]);
    expect(lanes).toEqual([0, 0]);
  });

  it('sees the overlap when an interval wraps midnight', () => {
    // Asleep 23:00–07:00 is both ends of the dial, so an alarm-to-shower block at
    // 06:30–07:15 overlaps its early half even though the numbers do not suggest it.
    const lanes = markerLanes([marker('Asleep', at(23), at(7)), marker('Waking', at(6, 30), at(7, 15))]);
    expect(laneCount(lanes)).toBe(2);
    // The wrapping interval covers 8h against 45m, so it takes the inner lane.
    expect(lanes).toEqual([0, 1]);
  });

  it('counts both halves of a wrapping interval when ranking length', () => {
    // 23:00–07:00 is 8 hours in two pieces; a 6-hour daytime block must not
    // out-rank it just because its single span is longer than either half.
    const lanes = markerLanes([marker('Midday', at(9), at(15)), marker('Asleep', at(23), at(7))]);
    expect(lanes[1]).toBe(0);
  });

  it('keeps moments off the lanes entirely', () => {
    // A moment draws across every lane, so it is never placed on one — and never
    // pushes an interval outward either.
    const lanes = markerLanes([marker('Alarm', at(12)), marker('Work', at(9), at(17))]);
    expect(lanes).toEqual([0, 0]);
    expect(laneCount(lanes)).toBe(1);
  });

  it('answers a lane for every marker it was given', () => {
    for (const list of [[], [marker('A', at(1))], [marker('A', at(1), at(2)), marker('B', at(1), at(3))]]) {
      expect(markerLanes(list)).toHaveLength(list.length);
    }
    expect(laneCount([])).toBe(0);
  });

  it('never needs more lanes than there are markers', () => {
    // Five mutually overlapping intervals is the worst case a reader can build.
    const all = Array.from({ length: MAX_MARKERS }, (_, i) => marker(`M${i}`, at(9), at(17) - i));
    expect(laneCount(markerLanes(all))).toBeLessThanOrEqual(MAX_MARKERS);
  });
});

describe('the radii a lane is drawn at', () => {
  const { markers: M } = VISUAL;

  it('leaves a single lane exactly where the band has always been', () => {
    // No overlaps must mean no visible change at all for an existing reader.
    expect(laneBand(0, 1)).toEqual({ inner: M.inner, outer: M.outer });
  });

  it('stacks lanes outward with air between them', () => {
    const first = laneBand(0, 2);
    const second = laneBand(1, 2);
    expect(first.inner).toBe(M.inner);
    expect(second.inner - first.outer).toBeCloseTo(M.laneGap, 9);
    expect(second.outer).toBeGreaterThan(first.outer);
  });

  it('never reaches past the bound that protects the hour numerals', () => {
    // The load-bearing one: past `maxOuter` the wedges tint the numerals'
    // backdrop and every contrast ratio measured for them stops being true.
    for (let count = 1; count <= MAX_MARKERS; count += 1) {
      for (let lane = 0; lane < count; lane += 1) {
        const band = laneBand(lane, count);
        expect(band.inner).toBeGreaterThanOrEqual(M.inner);
        expect(band.outer).toBeLessThanOrEqual(M.maxOuter + 1e-9);
        expect(band.outer).toBeGreaterThan(band.inner);
      }
    }
  });

  it('shrinks lane height only once the full height stops fitting', () => {
    const full = M.outer - M.inner;
    const heightAt = (count: number) => laneBand(0, count).outer - laneBand(0, count).inner;
    expect(heightAt(1)).toBeCloseTo(full, 9);
    expect(heightAt(2)).toBeCloseTo(full, 9);
    // By five lanes the band has to give, and every lane gives equally.
    expect(heightAt(MAX_MARKERS)).toBeLessThan(full);
    for (let lane = 1; lane < MAX_MARKERS; lane += 1) {
      const band = laneBand(lane, MAX_MARKERS);
      expect(band.outer - band.inner).toBeCloseTo(heightAt(MAX_MARKERS), 9);
    }
  });

  it('keeps every lane thick enough to see', () => {
    // ~1.7px per unit at a 375px viewport, so anything under ~1.5 units is a
    // hairline pretending to be a band.
    for (let count = 1; count <= MAX_MARKERS; count += 1) {
      const band = laneBand(0, count);
      expect(band.outer - band.inner).toBeGreaterThan(1.5);
    }
  });

  it('treats a zero count as one lane rather than dividing by it', () => {
    expect(laneBand(0, 0)).toEqual(laneBand(0, 1));
  });
});
