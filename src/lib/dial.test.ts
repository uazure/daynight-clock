import { describe, expect, it } from 'vitest';
import { meanLightnessAround, sampleIndexForHour } from './dial';
import { SAMPLES_PER_DAY } from './sun';

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

describe('meanLightnessAround', () => {
  /** A day whose every minute has the same lightness. */
  const flat = (value: number) => new Float64Array(SAMPLES_PER_DAY).fill(value);

  it('returns the value itself when the face is one tone', () => {
    // Polar day and polar night both land here, and both must pick an ink.
    expect(meanLightnessAround(flat(1), 12, 3.5)).toBeCloseTo(1, 10);
    expect(meanLightnessAround(flat(0.04), 0, 3.5)).toBeCloseTo(0.04, 10);
  });

  it('averages the hours the block actually spans, not the one behind its centre', () => {
    // A day that is dark until 09:00 and light after. A block centred on hour
    // 12 spanning 3.5 h reaches back to 08:30, so 30 of its 421 samples are
    // dark — it is still overwhelmingly a daylight backdrop, which is the
    // judgement a single sample at hour 12 could not make.
    const day = new Float64Array(SAMPLES_PER_DAY);
    for (let i = 9 * 60; i < SAMPLES_PER_DAY; i += 1) {
      day[i] = 1;
    }
    const mean = meanLightnessAround(day, 12, 3.5);
    expect(mean).toBeGreaterThan(0.9);
    expect(mean).toBeLessThan(1);
  });

  it('wraps across midnight rather than clamping at it', () => {
    // The countdown's block is centred on hour 0, so half its samples are the
    // end of the day and half the start. Clamped at zero it would read only the
    // morning and flip on the wrong half of the night.
    const day = new Float64Array(SAMPLES_PER_DAY);
    // Light for the last hour of the day only; everything else dark.
    for (let i = 23 * 60; i < SAMPLES_PER_DAY; i += 1) {
      day[i] = 1;
    }
    // 60 light samples out of 421 — reachable only by wrapping backwards.
    expect(meanLightnessAround(day, 0, 3.5)).toBeGreaterThan(0.1);
  });

  it('reads a symmetric span, so the centre hour is the middle of it', () => {
    // Light only after noon. A span centred on noon is then half light, half
    // dark, plus the one sample at the centre itself.
    const day = new Float64Array(SAMPLES_PER_DAY);
    for (let i = 12 * 60; i < SAMPLES_PER_DAY; i += 1) {
      day[i] = 1;
    }
    expect(meanLightnessAround(day, 12, 3.5)).toBeCloseTo(0.5, 1);
  });
});
