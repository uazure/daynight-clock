import { describe, expect, it } from 'vitest';
import {
  altitudeToLightness,
  contrastInk,
  FULL_DARK_DEG,
  FULL_LIGHT_DEG,
  HORIZON_DEG,
  labelInk,
  lightnessToFill,
  NIGHT_FLOOR,
  NIGHT_FLOOR_DEG,
  NIGHT_LIGHTNESS,
} from './lightness';
import { VISUAL } from './visual';

describe('altitudeToLightness', () => {
  it('hits full daylight at FULL_LIGHT_DEG and stays there', () => {
    expect(altitudeToLightness(FULL_LIGHT_DEG)).toBe(1);
    expect(altitudeToLightness(FULL_LIGHT_DEG + 0.1)).toBe(1);
    expect(altitudeToLightness(30)).toBe(1);
    expect(altitudeToLightness(90)).toBe(1);
  });

  it('hits the night plateau at FULL_DARK_DEG and the floor below NIGHT_FLOOR_DEG', () => {
    expect(altitudeToLightness(FULL_DARK_DEG)).toBeCloseTo(NIGHT_LIGHTNESS, 9);
    expect(altitudeToLightness(NIGHT_FLOOR_DEG)).toBeCloseTo(NIGHT_FLOOR, 9);
    expect(altitudeToLightness(NIGHT_FLOOR_DEG - 40)).toBeCloseTo(NIGHT_FLOOR, 9);
    expect(altitudeToLightness(-90)).toBeCloseTo(NIGHT_FLOOR, 9);
  });

  it('is continuous where the tail meets the ramp', () => {
    // The two branches meet at FULL_DARK_DEG. A discontinuity here would show
    // on the dial as a hard edge partway into dusk — the exact artefact the
    // smoothstep exists to avoid at the other end.
    const below = altitudeToLightness(FULL_DARK_DEG - 1e-9);
    const above = altitudeToLightness(FULL_DARK_DEG + 1e-9);
    expect(above - below).toBeCloseTo(0, 8);
  });

  it('joins both plateaus with near-zero slope', () => {
    // What smoothstep buys over a linear ramp: no kink where the transition
    // meets full daylight. Linear interpolation would leave the full 0.076/°
    // slope right up to the plateau and a visible crease on the dial.
    const slope = (a: number, b: number) => (altitudeToLightness(b) - altitudeToLightness(a)) / (b - a);
    const steepest = slope(-0.5, 0.5);
    expect(Math.abs(slope(FULL_LIGHT_DEG - 0.2, FULL_LIGHT_DEG))).toBeLessThan(steepest / 10);
    // The dark end joins the tail's own slope rather than zero, so compare
    // against that instead of against nothing.
    const tailSlope = (NIGHT_LIGHTNESS - NIGHT_FLOOR) / (FULL_DARK_DEG - NIGHT_FLOOR_DEG);
    expect(slope(FULL_DARK_DEG, FULL_DARK_DEG + 0.2)).toBeLessThan(steepest / 10 + tailSlope);
  });

  it('passes through mid-lightness at the true horizon', () => {
    // Not enforced by the function — a consequence of a symmetric window and
    // NIGHT_LIGHTNESS near 0.09. Asserted because both ink `flipAt` thresholds
    // are 0.5, so this is what puts the tone flip on sunrise and sunset. A
    // retune that moves it should fail here rather than quietly slide the flip
    // into daylight.
    // 0.5053 as the constants stand. Stated as a tolerance rather than pinned,
    // because the value itself carries no meaning — only its distance from 0.5.
    expect(Math.abs(altitudeToLightness(HORIZON_DEG) - 0.5)).toBeLessThan(0.01);
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

  it('treats the nautical and astronomical bands as night, not as twilight', () => {
    // The point of the narrow window: at -12° and -18° a city street is lit by
    // streetlights and nothing else, so those altitudes must read as night
    // rather than as two more shades of dusk. The old twilight-anchored ramp
    // put them at 0.32 and 0.14 — a third of the way to daylight.
    expect(altitudeToLightness(-12)).toBeLessThan(NIGHT_LIGHTNESS);
    expect(altitudeToLightness(-18)).toBeLessThan(NIGHT_LIGHTNESS);
    expect(altitudeToLightness(-12)).toBeLessThan(0.1);
  });

  it('spends most of its range inside the transition window', () => {
    // The fault this ramp replaced: the tail must stay a hint of shape for
    // polar dials, not a second transition competing with the real one.
    const tailRange = NIGHT_LIGHTNESS - NIGHT_FLOOR;
    expect(tailRange / (1 - NIGHT_FLOOR)).toBeLessThan(0.1);
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
