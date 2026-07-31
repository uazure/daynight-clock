import { describe, expect, it } from 'vitest';
import { sampleIndexForHour } from './dial';
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
