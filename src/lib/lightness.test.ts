import { describe, expect, it } from 'vitest';
import { altitudeToLightness, contrastInk, LIGHTNESS_ANCHORS, labelInk, lightnessToFill } from './lightness';
import { VISUAL } from './visual';

describe('altitudeToLightness', () => {
  it('returns exactly the anchor value at each anchor altitude', () => {
    for (const [altitude, lightness] of LIGHTNESS_ANCHORS) {
      expect(altitudeToLightness(altitude)).toBeCloseTo(lightness, 9);
    }
  });

  it('clamps above the brightest and below the darkest anchor', () => {
    const [darkestAlt, darkest] = LIGHTNESS_ANCHORS[0];
    const [brightestAlt, brightest] = LIGHTNESS_ANCHORS[LIGHTNESS_ANCHORS.length - 1];

    expect(altitudeToLightness(darkestAlt - 40)).toBeCloseTo(darkest, 9);
    expect(altitudeToLightness(brightestAlt + 40)).toBeCloseTo(brightest, 9);
    expect(altitudeToLightness(90)).toBeCloseTo(brightest, 9);
  });

  it('interpolates linearly between two anchors', () => {
    // Midway between -12 (0.32) and -6 (0.58).
    expect(altitudeToLightness(-9)).toBeCloseTo(0.45, 9);
  });

  it('never decreases as the sun climbs', () => {
    let previous = -Infinity;
    for (let altitude = -90; altitude <= 90; altitude += 0.25) {
      const current = altitudeToLightness(altitude);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('stays inside 0..1 across the whole domain', () => {
    for (let altitude = -90; altitude <= 90; altitude += 0.25) {
      const value = altitudeToLightness(altitude);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is dark at night, mid at civil twilight, bright in daylight', () => {
    expect(altitudeToLightness(-25)).toBeLessThan(0.15);
    expect(altitudeToLightness(-3)).toBeGreaterThan(0.6);
    expect(altitudeToLightness(30)).toBe(1);
  });
});

describe('lightnessToFill', () => {
  it('produces exact hsl strings with correct hue, saturation, and band', () => {
    // 5%..96% band at hue 220, saturation 12%
    expect(lightnessToFill(0)).toBe('hsl(220 12% 5.0%)');
    expect(lightnessToFill(1)).toBe('hsl(220 12% 96.0%)');
  });

  it('fills darker for lower lightness (catches inverted band)', () => {
    const darkFill = lightnessToFill(0.2);
    const brightFill = lightnessToFill(0.8);
    // Extract the percentage from hsl() and compare numerically. The assertion
    // is the point: `lightnessToFill` is pinned to a one-decimal format above,
    // so a match failure is a real regression and should surface as one rather
    // than quietly becoming `undefined` and NaN.
    const darkPercent = parseFloat(darkFill.match(/\d+\.\d%/)![0]);
    const brightPercent = parseFloat(brightFill.match(/\d+\.\d%/)![0]);
    expect(darkPercent).toBeLessThan(brightPercent);
  });

  it('takes its hue, saturation and band from the shared config', () => {
    // The seam, rather than a second copy of the numbers: retune the palette in
    // visual.ts and the exact strings above are what needs updating, not this.
    const { hue, saturation, band } = VISUAL.palette;
    expect(lightnessToFill(0)).toBe(`hsl(${hue} ${saturation}% ${band.min.toFixed(1)}%)`);
    expect(lightnessToFill(1)).toBe(`hsl(${hue} ${saturation}% ${band.max.toFixed(1)}%)`);
  });
});

describe('contrastInk', () => {
  it('inks dark on a bright dial and light on a dark dial', () => {
    expect(contrastInk(0.95)).toBe(contrastInk(0.8));
    expect(contrastInk(0.1)).toBe(contrastInk(0.2));
    expect(contrastInk(0.95)).not.toBe(contrastInk(0.1));
  });

  it('uses exact hsl strings pinned to the threshold logic', () => {
    // lightness > 0.5 → dark ink (12%), else light ink (92%)
    expect(contrastInk(0.7)).toBe('hsl(220 12% 12%)');
    expect(contrastInk(0.3)).toBe('hsl(220 12% 92%)');
  });

  it('takes both tones and the threshold from the tick config', () => {
    const { dark, light, flipAt } = VISUAL.ticks.ink;
    expect(contrastInk(flipAt + 0.01)).toBe(dark);
    expect(contrastInk(flipAt - 0.01)).toBe(light);
    // Exactly at the threshold counts as the darker side of the ramp, so the
    // flip has one unambiguous direction.
    expect(contrastInk(flipAt)).toBe(light);
  });
});

describe('labelInk', () => {
  it('fills with the tone that contrasts and haloes with the other', () => {
    const { inkDark, inkLight } = VISUAL.hourLabels;
    // Bright face → dark glyph; dark face → bright glyph. Getting this backwards
    // is what made a fixed pair render hollow numerals over the night sector.
    expect(labelInk(0.9)).toEqual({ fill: inkDark, outline: inkLight });
    expect(labelInk(0.1)).toEqual({ fill: inkLight, outline: inkDark });
  });

  it('never returns the same tone twice', () => {
    // Fill and outline drawn from one tone is an invisible glyph. The paired
    // return makes that unrepresentable; this pins it across the whole ramp.
    for (let lightness = 0; lightness <= 1; lightness += 0.05) {
      const { fill, outline } = labelInk(lightness);
      expect(fill, `at ${lightness}`).not.toBe(outline);
    }
  });

  it("flips at its own threshold, not the ticks'", () => {
    // Separate knobs on purpose, so the numerals and the ticks can be tuned
    // independently — this is the test that fails if one starts reading the
    // other's config.
    const { flipAt } = VISUAL.hourLabels;
    expect(labelInk(flipAt + 0.01).fill).toBe(VISUAL.hourLabels.inkDark);
    expect(labelInk(flipAt).fill).toBe(VISUAL.hourLabels.inkLight);
  });

  it('draws only from the two tones the config names', () => {
    const allowed = new Set([VISUAL.hourLabels.inkDark, VISUAL.hourLabels.inkLight]);
    for (let lightness = 0; lightness <= 1; lightness += 0.1) {
      const { fill, outline } = labelInk(lightness);
      expect(allowed).toContain(fill);
      expect(allowed).toContain(outline);
    }
  });
});
