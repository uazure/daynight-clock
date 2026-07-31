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
  [-0.833, 0.88], // sunrise / sunset, refraction-corrected
  [6, 1.0], // full daylight
] as const satisfies ReadonlyArray<readonly [number, number]>

export function altitudeToLightness(altitudeDeg: number): number {
  const first = LIGHTNESS_ANCHORS[0]
  const last = LIGHTNESS_ANCHORS[LIGHTNESS_ANCHORS.length - 1]

  if (altitudeDeg <= first[0]) return first[1]
  if (altitudeDeg >= last[0]) return last[1]

  for (let i = 1; i < LIGHTNESS_ANCHORS.length; i += 1) {
    const [highAlt, highLight] = LIGHTNESS_ANCHORS[i]
    if (altitudeDeg > highAlt) continue

    const [lowAlt, lowLight] = LIGHTNESS_ANCHORS[i - 1]
    const t = (altitudeDeg - lowAlt) / (highAlt - lowAlt)
    return lowLight + t * (highLight - lowLight)
  }

  return last[1]
}

/** Single hue, so the dial reads as one monochrome luminance scale. */
const HUE = 220
const SATURATION = 12

/** Maps 0..1 onto a 5%..96% HSL lightness band. */
export function lightnessToFill(lightness: number): string {
  const percent = 5 + lightness * 91
  return `hsl(${HUE} ${SATURATION}% ${percent.toFixed(1)}%)`
}

const INK_DARK = `hsl(${HUE} ${SATURATION}% 12%)`
const INK_LIGHT = `hsl(${HUE} ${SATURATION}% 92%)`

/** Ink that stays legible on the fill produced for the same lightness. */
export function contrastInk(lightness: number): string {
  return lightness > 0.5 ? INK_DARK : INK_LIGHT
}

/**
 * The opposite tone, for outlining ink that lands on a mid-tone fill.
 *
 * `contrastInk` flips at lightness 0.5, and just either side of that flip it
 * is a mid-tone on a mid-tone: the ratio falls to about 3.5:1, against 14:1
 * or better at both ends of the ramp. That dip sits in the civil-twilight
 * band — exactly where a reader looks to find dawn and dusk. Stroking the
 * glyph in this tone under its own fill (`paint-order: stroke`) means it
 * reads against the outline rather than against the dial, so legibility stops
 * depending on where the ramp happens to be.
 */
export function contrastHalo(lightness: number): string {
  return lightness > 0.5 ? INK_LIGHT : INK_DARK
}
