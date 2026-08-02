import { VISUAL } from './visual';

/**
 * Apparent altitude of the sun's centre at sunrise and sunset. Both an anchor
 * of the ramp below and the threshold `sunEvents` solves for, so the time the
 * panel prints is exactly where the ring changes shade — one definition of
 * sunrise, not two that can drift apart.
 *
 * NOT the familiar -0.833°. That figure is the *geometric* centre altitude at
 * sunrise: half a solar diameter (0.267°) plus standard refraction (0.566°)
 * below the true horizon. But `suncalc`'s `getPosition().altitude` is the
 * *apparent* altitude — refraction is already added in — so comparing it
 * against -0.833° subtracts refraction a second time and fires the crossing
 * early. Measured against suncalc's own `getTimes()`, the double count cost
 * 3.0 min at Prague and Kyiv and 4.4 min at Reykjavík, every day of the year.
 *
 * The value is -0.833° with refraction added back, using the same Meeus 16.4
 * model suncalc applies (`1.02 / tan(h + 10.26 / (h + 5.10))` arcmin, which
 * suncalc clamps to h = 0 for negative altitudes, giving 0.484°). That makes it
 * exactly the apparent altitude suncalc's `getTimes().sunrise` sits at, which
 * `sun.test.ts` pins directly rather than trusting this arithmetic.
 */
export const HORIZON_DEG = -0.349;

/**
 * Where the ramp below reaches full daylight, and where it reaches the night
 * plateau. Everything between the two is transition; outside them the face is
 * flat (bar the shallow tail described under `NIGHT_FLOOR_*`).
 *
 * These two numbers are the whole day/night presentation, so the reasoning:
 *
 * **The window is deliberately narrow, and deliberately not the twilight
 * bands.** Anchoring on civil/nautical/astronomical twilight (-6/-12/-18) is
 * the obvious move and it was what this ramp did. It reads badly, for three
 * measurable reasons. A -30°…+6° ramp is still changing tone for 491 min of a
 * Prague equinox day — 123° of dial arc — so there is no dark *block*, just a
 * smear either side of a brief floor. The floor needs -30°, which mid-latitude
 * summer never reaches: Prague bottomed out at lightness 0.20 on 21 June
 * against 0.06 in December, painting the same "night" two different greys, and
 * 48 nights a year there never got dark at all. And the slope was inverted —
 * 0.058 lightness/° in the -6°…-0.833° band against 0.018/° from sunrise to
 * +6°, so deep twilight hogged the contrast while sunrise and noon were nearly
 * the same shade.
 *
 * **-6° because this is a city clock.** Clear-sky horizontal illuminance runs
 * ~600 lx at the horizon, ~100 lx at -3° (where streetlight photocells trip),
 * and 3.4 lx at -6°, the conventional end of civil twilight. Urban street
 * lighting delivers 5-30 lx at ground level, so below about -6° a city street
 * has stopped getting darker — the sky keeps dimming for another 12°, but
 * nothing a person standing in a city can see changes. Measured, not just
 * modelled: Bin Hussin et al., *Sci Rep* 14 (2024), found twilight sky
 * brightness stops changing at 11.5° solar depression at their most
 * light-polluted site against 17.5° at a pristine one. The nautical and
 * astronomical bands are for sighting a horizon at sea and for finding stars.
 * On this dial they carried a quarter of the lightness range and no
 * information.
 *
 * **+6° because that is where the sun stops being low.** ~6 000 lx, the end of
 * golden hour; ~12 000 lx by +10°, and flat from there as far as the eye
 * grades it.
 */
export const FULL_DARK_DEG = -6;
export const FULL_LIGHT_DEG = 6;

/** Lightness at and below `FULL_DARK_DEG`, before the tail below it. */
export const NIGHT_LIGHTNESS = 0.09;

/**
 * The tail below `FULL_DARK_DEG`: a shallow linear fade from `NIGHT_LIGHTNESS`
 * down to `NIGHT_FLOOR` at `NIGHT_FLOOR_DEG`, worth ~5% of the lightness range.
 *
 * Without it a hard plateau at -6° is defensible but costs the polar dials
 * their shape: Svalbard on 21 December spans -34.7°…-11.2°, entirely below the
 * plateau, so the whole disc would be one flat tone with nothing marking solar
 * noon. The slope is kept far too shallow to compete with the real transition —
 * 0.003/° against 0.076/° at the steepest point of the ramp — so at latitudes
 * that have a sunrise it is invisible, which is the point.
 */
export const NIGHT_FLOOR = 0.04;
export const NIGHT_FLOOR_DEG = -24;

/** Hermite ease, zero slope at both ends, so the ramp joins each plateau without a kink. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Sun altitude (degrees) → dial lightness (0..1).
 *
 * Monotonic and continuous across the whole domain, which `lightness.test.ts`
 * sweeps: the tail meets the ramp at `FULL_DARK_DEG` because both evaluate to
 * `NIGHT_LIGHTNESS` there, and the ramp meets daylight at `FULL_LIGHT_DEG`
 * with zero slope on both sides.
 *
 * One property worth keeping if these constants are ever retuned: the ramp
 * passes through lightness 0.5 within a few hundredths of a degree of
 * `HORIZON_DEG`, so the day/night midpoint of the gradient lands on the true
 * horizon — which is where a reader looks for it, and where `VISUAL`'s two ink
 * `flipAt: 0.5` thresholds therefore now flip. It is a consequence of the three
 * values (a symmetric window, and `NIGHT_LIGHTNESS` near 0.09), not something
 * this function enforces; `lightness.test.ts` asserts it so a retune that
 * breaks it fails loudly rather than quietly sliding the ink flip into daylight.
 */
export function altitudeToLightness(altitudeDeg: number): number {
  if (altitudeDeg >= FULL_LIGHT_DEG) {
    return 1;
  }

  if (altitudeDeg <= FULL_DARK_DEG) {
    if (altitudeDeg <= NIGHT_FLOOR_DEG) {
      return NIGHT_FLOOR;
    }
    const t = (altitudeDeg - NIGHT_FLOOR_DEG) / (FULL_DARK_DEG - NIGHT_FLOOR_DEG);
    return NIGHT_FLOOR + t * (NIGHT_LIGHTNESS - NIGHT_FLOOR);
  }

  const t = (altitudeDeg - FULL_DARK_DEG) / (FULL_LIGHT_DEG - FULL_DARK_DEG);
  return NIGHT_LIGHTNESS + smoothstep(t) * (1 - NIGHT_LIGHTNESS);
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
