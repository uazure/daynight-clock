import { describe, expect, it } from 'vitest';
import {
  isMoment,
  MAX_LABEL_LENGTH,
  MAX_MARKERS,
  type Marker,
  markerSpans,
  momentPhase,
  nextBoundary,
  parseMarkers,
  readoutLines,
  spanPhase,
} from './markers';

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
