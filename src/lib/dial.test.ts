import { describe, expect, it } from 'vitest'
import { DIAL, sampleIndexForHour } from './dial'
import { SAMPLES_PER_DAY } from './sun'

describe('DIAL', () => {
  it('nests every radius inside the face', () => {
    for (const radius of [
      DIAL.hourTickInner,
      DIAL.hourTickInnerStrong,
      DIAL.hourLabel,
      DIAL.hourHand,
      DIAL.minuteHand,
      DIAL.hub,
    ]) {
      expect(radius).toBeGreaterThan(0)
      expect(radius).toBeLessThanOrEqual(DIAL.face)
    }
  })

  it('fits inside the 200-unit viewBox with room for the stroke', () => {
    expect(DIAL.face).toBeLessThan(100)
  })

  it('draws emphasised ticks longer than plain ones', () => {
    expect(DIAL.hourTickInnerStrong).toBeLessThan(DIAL.hourTickInner)
  })

  it('keeps the hour hand shorter than the minute hand, as on a 24h dial', () => {
    expect(DIAL.hourHand).toBeLessThan(DIAL.minuteHand)
  })
})

describe('sampleIndexForHour', () => {
  it('maps midnight to the first sample', () => {
    expect(sampleIndexForHour(0)).toBe(0)
  })

  it('maps noon to the middle sample', () => {
    expect(sampleIndexForHour(12)).toBe(SAMPLES_PER_DAY / 2)
  })

  it('wraps the end of the day back to the first sample', () => {
    expect(sampleIndexForHour(24)).toBe(0)
  })

  it('stays in range for every hour of the day', () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const index = sampleIndexForHour(hour)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(SAMPLES_PER_DAY)
      expect(Number.isInteger(index)).toBe(true)
    }
  })
})
