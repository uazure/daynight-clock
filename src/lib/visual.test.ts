import { describe, expect, it } from 'vitest';
import { altitudeToLightness, FULL_DARK_DEG, FULL_LIGHT_DEG, HORIZON_DEG, NIGHT_LIGHTNESS } from './lightness';
import { MINUTES_PER_SAMPLE, SAMPLES_PER_DAY } from './sun';
import { VISUAL } from './visual';

/**
 * WHAT THIS FILE DOES NOT TEST, AND WHY.
 *
 * **Nothing here asserts where anything is.** This file used to pin the dial's
 * whole geometry — box corners inside the wedge band, glyph caps clearing the
 * hub, hands stopping short of the numerals, one line's baseline against the
 * next — and every one of those pins was a guess at the right *look* frozen
 * into an assertion. The cost showed up the moment the layout was being
 * designed rather than merely kept: moving a line four units failed two tests
 * that were not describing a defect, only a previous opinion. Taste belongs in
 * `visual.ts`'s doc comments, where each constant carries its range and the
 * reasoning behind it, and in an eye on the actual dial. A rendered SVG is the
 * only honest judge of whether a layout works, and node cannot render one.
 *
 * The same goes for **rankings**: which wedge opacity is loudest, whether the
 * clock is the largest type, whether the minute numerals sit lighter than the
 * hour numerals. Those are all real decisions and all documented, but a test
 * that repeats them just makes the config harder to edit.
 *
 * **What survives is what is not a matter of taste**:
 *
 * - the theme and hue rules (AGENTS.md rule 5), which are architectural — a
 *   fourth `var(--…)` or a second hue changes what the dial *is*;
 * - the ink pairs bracketing the lightness ramp, which is legibility rather
 *   than preference: converge a pair and text over the gradient stops being
 *   readable at one end of the day;
 * - where the ink flips land on the sun's own ramp, a cross-module agreement
 *   between `visual.ts` and `lightness.ts` that neither file can check alone;
 * - arithmetic that would break the render rather than merely look wrong — a
 *   `step` that does not divide its scale, a negative or zero measurement.
 *
 * Layout regressions are caught by looking at the dial. These are caught here
 * because looking would not reveal them.
 */

/**
 * The numbers out of an `hsl()` string, whichever separator style it uses —
 * space-separated, comma-separated, or with a `/ alpha`. Parsing loosely is the
 * point: a check that only understood one spelling would wave the others
 * through, which is how a stray hue once slipped past.
 */
const channels = (colour: string) => (colour.match(/-?[\d.]+/g) ?? []).map(Number);
const hueOf = (colour: string) => channels(colour)[0];
const lightnessOf = (colour: string) => channels(colour)[2];

const { palette, ring, ticks, hourLabels, minuteLabels, markers, hubText, digital } = VISUAL;

interface Leaf {
  path: string;
  value: number | string;
}

/** Flattens the config so a single assertion can sweep every value in it. */
function leaves(node: unknown, path = ''): Leaf[] {
  if (typeof node === 'number' || typeof node === 'string') {
    return [{ path, value: node }];
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) =>
      leaves(child, path === '' ? key : `${path}.${key}`),
    );
  }
  return [];
}

const allLeaves = leaves(VISUAL);
const numbers = allLeaves.filter((leaf) => typeof leaf.value === 'number');
const colours = allLeaves.filter((leaf) => typeof leaf.value === 'string' && leaf.value.includes('('));

describe('where the countdown is configured from', () => {
  it('gives it one set of dials for both of the forms it takes', () => {
    // Not a layout pin — a wiring one, and the regression it exists for is
    // real: the compact line's numbers once lived under `VISUAL.digital` while
    // `MarkerReadout` — the only reader of `markers.readout` — was skipped
    // whenever the digital clock was on. Every value in that block was then
    // unreachable in the app's default state, so editing the block named after
    // the countdown changed nothing on screen. No amount of looking at the
    // dial reveals *that*; you just conclude the config is broken.
    expect(markers.readout.compact).toBeDefined();
    expect(markers.readout.label).toBeDefined();
    // Whatever `VISUAL.digital` holds, it is the clock and the date only — a
    // countdown line reappearing there is the shape of the old bug.
    expect(Object.keys(digital)).not.toContain('next');
  });
});

describe('the dial palette', () => {
  it('paints the dial itself in theme-independent colour', () => {
    // AGENTS.md rule 5: the theme switches page chrome, never the dial. The
    // three exceptions each paint on or outside the face's edge, where the
    // backdrop really is the page — the rim straddles it, the year knob stands on
    // it, the minute band sits beyond that. Everything
    // else lands on the day/night gradient and must not move when the theme
    // does. Exact equality, so a fourth cannot be added without arguing for it.
    const themed = colours.filter((leaf) => String(leaf.value).includes('var('));
    expect(themed.map((leaf) => leaf.path).sort()).toEqual(['face.rim.color', 'minuteLabels.fill', 'yearKnob.color']);
  });

  it('keeps every literal colour on the palette hue, with no exceptions', () => {
    // Saturation deliberately varies — 12% for the ramp and the ink, 14% for
    // the hand core — but a stray hue would break the monochrome scale. The
    // markers used to be the one pinned exception, on an accent hue; they now
    // separate by inversion instead, so the whole dial is on one hue and a
    // second one has to be argued for here first. Matches `hsla(` as well as
    // `hsl(`, so a change of spelling cannot dodge the check.
    const literals = colours.filter((leaf) => String(leaf.value).startsWith('hsl'));
    expect(literals.length).toBeGreaterThan(0);
    for (const { path, value } of literals) {
      expect(hueOf(String(value)), path).toBe(palette.hue);
    }
  });

  it('maps lightness onto an ordered band inside HSL range', () => {
    expect(palette.band.min).toBeLessThan(palette.band.max);
    expect(palette.band.min).toBeGreaterThanOrEqual(0);
    expect(palette.band.max).toBeLessThanOrEqual(100);
  });

  it('brackets the ramp with every pair that has to read over it', () => {
    // Legibility, not preference. Anything drawn on the face has to survive a
    // ramp running L96% to L5%, and no single tone can: dark over daylight is
    // light over night. So each of these is a *pair*, one half always far from
    // the face behind it — the marks and the hands, the hour numerals, the
    // text at the hub. Let a pair converge and the mechanism that keeps them
    // readable quietly stops working, which is invisible on the dial until you
    // happen to look at the wrong hour of the wrong day.
    for (const [name, dark, light] of [
      ['markers', markers.core, markers.halo],
      ['hourLabels', hourLabels.inkDark, hourLabels.inkLight],
      ['hubText', hubText.dark, hubText.light],
    ] as const) {
      expect(dark, name).not.toBe(light);
      expect(lightnessOf(light) - lightnessOf(dark), name).toBeGreaterThanOrEqual(60);
      expect(lightnessOf(dark), name).toBeLessThan(palette.band.min + 15);
      expect(lightnessOf(light), name).toBeGreaterThan(palette.band.max - 15);
    }
  });

  it('keeps the countdown caption between the two hub tones, not at either end', () => {
    // The grey has to be legible over the night fan and still recede under the
    // clock. Landing on either tone of the pair means it is no longer a
    // caption; landing outside them means it is no longer on the ramp's scale.
    const grey = lightnessOf(markers.readout.compact.color);
    expect(grey).toBeGreaterThan(lightnessOf(hubText.dark));
    expect(grey).toBeLessThan(lightnessOf(hubText.light));
  });

  it("flips every ink inside the ramp's transition, not on a plateau", () => {
    // The ramp is flat at `NIGHT_LIGHTNESS` and below, and flat at 1 above
    // `FULL_LIGHT_DEG`; everything between is transition. A flip has to land in
    // that transition: it exists to serve the mid-tones, where contrast against
    // the face is weakest. Put it outside and the ink is effectively
    // single-toned across the whole lit or whole dark part of the day, with
    // 0.99 (light-on-light nearly all the way round) being the failure this
    // catches.
    for (const flipAt of [ticks.ink.flipAt, hourLabels.flipAt, hubText.flipAt]) {
      expect(flipAt).toBeGreaterThan(NIGHT_LIGHTNESS);
      expect(flipAt).toBeLessThan(1);
    }
    expect(ticks.ink.dark).not.toBe(ticks.ink.light);
  });

  it('puts every ink flip within minutes of sunrise and sunset', () => {
    // A cross-module agreement neither file can check alone: the altitude at
    // which each ink flips should be the horizon, so a numeral changes tone as
    // the sun crosses it rather than somewhere arbitrary in dusk. Solved by
    // bisection on the real ramp so this follows a retune of `lightness.ts`
    // instead of restating its arithmetic.
    for (const flipAt of [ticks.ink.flipAt, hourLabels.flipAt, hubText.flipAt]) {
      let lo = FULL_DARK_DEG;
      let hi = FULL_LIGHT_DEG;
      for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (altitudeToLightness(mid) < flipAt) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      // Within a quarter degree of the horizon — about a minute of clock time
      // at mid latitudes, so under one dial slice.
      expect(Math.abs((lo + hi) / 2 - HORIZON_DEG)).toBeLessThan(0.25);
    }
  });

  it('means a hub block over hours that are behind it, and no further', () => {
    // Not a look: dawn and dusk sit at hours 6 and 18, behind neither hub
    // block, so a span wide enough to reach them decides the flip on shading
    // the glyphs are nowhere near.
    expect(hubText.flipSpanHours).toBeGreaterThan(2);
    expect(hubText.flipSpanHours).toBeLessThan(6);
  });

  it('overlaps ring slices enough to hide seams and little enough to stay honest', () => {
    // Zero overlap leaves antialiased hairlines between all 1440 wedges. Too
    // much and a slice paints well past its own minute of the day; later
    // slices cover the excess, but the wrap at the bottom of the dial cannot
    // be covered, so the overlap shows there as the wrong sample.
    const sliceDeg = 360 / SAMPLES_PER_DAY;
    expect(ring.sliceOverlapDeg).toBeGreaterThan(0);
    expect((ring.sliceOverlapDeg / sliceDeg) * MINUTES_PER_SAMPLE).toBeLessThanOrEqual(2);
  });
});

describe('every value in the config', () => {
  it('divides its scale evenly, so no numeral or tick is orphaned', () => {
    // Arithmetic, not taste: a step that does not divide leaves a ragged gap
    // where the scale wraps, and an anchor tick landing on an unlabelled hour
    // is emphasis attached to nothing.
    expect(24 % hourLabels.step).toBe(0);
    expect(60 % minuteLabels.step).toBe(0);
    expect(ticks.anchorStep % hourLabels.step).toBe(0);
  });

  it('is a finite, non-negative measurement', () => {
    // Signs are kept positive here and negated at the call site, so a negative
    // is a typo rather than a direction. Zero is allowed and meaningful: it
    // turns a feature off — `outlineWidth: 0` is a numeral with no halo,
    // `haloWidth: 0` a hub with no ring.
    expect(numbers.length).toBeGreaterThan(0);
    for (const { path, value } of numbers) {
      expect(Number.isFinite(value), path).toBe(true);
      expect(value, path).toBeGreaterThanOrEqual(0);
    }
  });

  it('is strictly positive wherever zero would be nonsense', () => {
    // A geometry or type value of zero is a degenerate dial, not a style: no
    // extent, an invisible glyph, a tick of no length. A `step` of zero is
    // worse than degenerate — the render loops advance by it, so it would hang
    // the component rather than merely look wrong.
    const mustBePositive = /(^|\.)(extent|radius|size|step|weight|inner|outer|length|hue)$|\.max$/;
    const required = numbers.filter((leaf) => mustBePositive.test(leaf.path));
    expect(required.length).toBeGreaterThan(0);
    for (const { path, value } of required) {
      expect(value, path).toBeGreaterThan(0);
    }
  });
});
