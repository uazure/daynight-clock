import { VISUAL } from './visual';

/**
 * Altitude of the sun's centre at sunrise and sunset: half a solar diameter
 * below the true horizon, plus standard atmospheric refraction. Both an anchor
 * of the ramp below and the threshold `sunEvents` solves for, so the time the
 * panel prints is exactly where the ring changes shade — one definition of
 * sunrise, not two that can drift apart.
 */
export const HORIZON_DEG = -0.833;

/**
 * Sun altitude (degrees) → dial lightness (0..1), as a piecewise-linear ramp.
 * Anchors are the conventional twilight boundaries, so the ring reads as a
 * smooth gradient while the thresholds stay visible as inflection points.
 * Must stay sorted ascending by altitude.
 */
export const LIGHTNESS_ANCHORS = [
  [-30, 0.06], // deep night floor
  [-18, 0.14], // astronomical twilight ends
  [-12, 0.32], // nautical twilight ends
  [-6, 0.58], // civil twilight ends
  [HORIZON_DEG, 0.88], // sunrise / sunset, refraction-corrected
  [6, 1.0], // full daylight
] as const satisfies ReadonlyArray<readonly [number, number]>;

export function altitudeToLightness(altitudeDeg: number): number {
  const first = LIGHTNESS_ANCHORS[0];
  const last = LIGHTNESS_ANCHORS[LIGHTNESS_ANCHORS.length - 1];

  if (altitudeDeg <= first[0]) {
    return first[1];
  }
  if (altitudeDeg >= last[0]) {
    return last[1];
  }

  for (let i = 1; i < LIGHTNESS_ANCHORS.length; i += 1) {
    const [highAlt, highLight] = LIGHTNESS_ANCHORS[i];
    if (altitudeDeg > highAlt) {
      continue;
    }

    const [lowAlt, lowLight] = LIGHTNESS_ANCHORS[i - 1];
    const t = (altitudeDeg - lowAlt) / (highAlt - lowAlt);
    return lowLight + t * (highLight - lowLight);
  }

  return last[1];
}

/**
 * A dial lightness as an `hsl()` fill, on the single hue that makes the face
 * read as one monochrome luminance scale. The hue, the saturation and the band
 * this maps onto are all in `visual.ts`; the one-decimal formatting stays here
 * because it is an output format rather than a visual choice, and
 * `lightness.test.ts` pins the exact strings it produces.
 */
export function lightnessToFill(lightness: number): string {
  const { hue, saturation, band } = VISUAL.palette;
  const percent = band.min + lightness * (band.max - band.min);
  return `hsl(${hue} ${saturation}% ${percent.toFixed(1)}%)`;
}

/**
 * Ink that stays legible on the fill produced for the same lightness, by
 * flipping tone partway along the ramp.
 *
 * Only the ticks use this. They are too thin to carry an outline the way the
 * numerals do — a 0.5-wide hairline stroked in a second colour is just a
 * blurred hairline — so they have to contrast with the face directly, and the
 * tones and threshold live with them in `VISUAL.ticks.ink`. Anything that can
 * be outlined instead should be: near the flip this is a mid-tone on a
 * mid-tone, about 3.5:1 against 14:1 or better at both ends of the ramp, and
 * that dip sits in the civil-twilight band — exactly where a reader looks to
 * find dawn and dusk.
 */
export function contrastInk(lightness: number): string {
  const { dark, light, flipAt } = VISUAL.ticks.ink;
  return lightness > flipAt ? dark : light;
}

export interface LabelInk {
  /** The glyph itself: whichever tone contrasts with the face here. */
  fill: string;
  /** Stroked underneath the fill, so the glyph reads against this, not the dial. */
  outline: string;
}

/**
 * Both tones for a numeral sitting on the shaded face, as a pair.
 *
 * Returned together rather than as two functions because they are only correct
 * *opposed*: fill and outline drawn from the same tone is an invisible glyph,
 * and the pair the wrong way round is a hollow one. Making that structural
 * beats testing for it — the old two-call arrangement needed a test asserting
 * the two never agreed.
 */
export function labelInk(lightness: number): LabelInk {
  const { inkDark, inkLight, flipAt } = VISUAL.hourLabels;
  return lightness > flipAt ? { fill: inkDark, outline: inkLight } : { fill: inkLight, outline: inkDark };
}
