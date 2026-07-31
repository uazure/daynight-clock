import { describe, expect, it } from 'vitest'
import {
  DIAL,
  DIAL_TYPE,
  HOUR_LABEL_STEP,
  MINUTE_LABEL_STEP,
  sampleIndexForHour,
} from './dial'
import { angleForHour, angleForMinute } from './geometry'
import { SAMPLES_PER_DAY } from './sun'

/** Normalises a dial angle onto 0..360 so the two scales can be compared. */
const turn = (deg: number) => ((deg % 360) + 360) % 360

describe('DIAL', () => {
  it('nests everything drawn on the shaded face inside it', () => {
    for (const radius of [
      DIAL.tickInner.every1h,
      DIAL.tickInner.every2h,
      DIAL.tickInner.every6h,
      DIAL.hourLabel,
      DIAL.hourHand,
      DIAL.minuteHand,
      DIAL.hub,
    ]) {
      expect(radius).toBeGreaterThan(0)
      expect(radius).toBeLessThanOrEqual(DIAL.face)
    }
  })

  it('fits inside the 200-unit viewBox, minute numerals and all', () => {
    expect(DIAL.face).toBeLessThan(100)
    // Only half the glyph extends past the band's radius; allowing a whole
    // font size leaves the margin the outer band needs to not look clipped.
    expect(DIAL.minuteLabel + DIAL_TYPE.minuteLabel).toBeLessThanOrEqual(100)
  })

  it('lengthens each tick tier in step with its emphasis', () => {
    // Longer tick = further in. Quarter-day anchors are longest, then the
    // hours carrying a numeral, then the plain ones.
    expect(DIAL.tickInner.every6h).toBeLessThan(DIAL.tickInner.every2h)
    expect(DIAL.tickInner.every2h).toBeLessThan(DIAL.tickInner.every1h)
  })

  it('keeps the hour hand shorter than the minute hand, as on a 24h dial', () => {
    expect(DIAL.hourHand).toBeLessThan(DIAL.minuteHand)
  })

  it('stops the hour hand short of the numerals it points at', () => {
    expect(DIAL.hourHand).toBeLessThan(DIAL.hourLabel)
  })

  it('stops the minute hand short of the longest tick, with clear air', () => {
    // The minute hand reads the outer band by angle rather than by reaching
    // it, so it gains nothing from running the full radius — and a tip that
    // stops before the quarter-day ticks avoids crowding them.
    expect(DIAL.minuteHand).toBeLessThan(DIAL.tickInner.every6h)
    expect(DIAL.tickInner.every6h - DIAL.minuteHand).toBeGreaterThanOrEqual(2)
    // Still outside the hour numerals, so the two hands stay tellable apart.
    expect(DIAL.minuteHand).toBeGreaterThan(DIAL.hourLabel)
  })
})

describe('the two numeral scales', () => {
  const labelledHours = [...Array(24).keys()].filter((h) => h % HOUR_LABEL_STEP === 0)
  const labelledMinutes = [...Array(60).keys()].filter(
    (m) => m % MINUTE_LABEL_STEP === 0,
  )

  it('divides both scales evenly, so no numeral is orphaned', () => {
    expect(24 % HOUR_LABEL_STEP).toBe(0)
    expect(60 % MINUTE_LABEL_STEP).toBe(0)
  })

  it('puts every labelled minute at the same angle as a labelled hour', () => {
    // Not a defect — a consequence of one circle carrying both scales at
    // different rates. Minute 10 sits at 60°, which is also hour 16; minute
    // 30 sits at the bottom, which is also hour 0. This is the test that
    // justifies the radial separation asserted below: since the two scales
    // cannot be told apart by angle, radius has to do all of that work.
    const hourAngles = new Set(labelledHours.map((h) => turn(angleForHour(h))))
    for (const minute of labelledMinutes) {
      expect(hourAngles).toContain(turn(angleForMinute(minute)))
    }
  })

  it('separates the two scales by the whole tick band and the face outline', () => {
    // Minute numerals sit outside the shaded face, hour numerals well inside
    // it. Moving the minute band inside the face would stack it on the hour
    // numerals at all six of the shared angles above.
    expect(DIAL.minuteLabel).toBeGreaterThan(DIAL.face)
    expect(DIAL.hourLabel).toBeLessThan(DIAL.tickInner.every6h)
  })

  it('sets minute numerals smaller than hour numerals', () => {
    expect(DIAL_TYPE.minuteLabel).toBeLessThan(DIAL_TYPE.hourLabel)
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
