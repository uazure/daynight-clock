import { describe, expect, it } from 'vitest';
import { angleForHour, angleForMinute } from './geometry';
import { altitudeToLightness, FULL_DARK_DEG, FULL_LIGHT_DEG, HORIZON_DEG, NIGHT_LIGHTNESS } from './lightness';
import { MINUTES_PER_SAMPLE, SAMPLES_PER_DAY } from './sun';
import { VISUAL } from './visual';

const { canvas, face, palette, ring, ticks, hourLabels, minuteLabels, yearKnob, markers, hands } = VISUAL;

/** Normalises a dial angle onto 0..360 so the two scales can be compared. */
const turn = (deg: number) => ((deg % 360) + 360) % 360;

/** Half the visual width of a numeral, outline included. */
const glyphReach = (size: number, outlineWidth = 0) => size / 2 + outlineWidth / 2;

/** Half the painted width of a stroke, i.e. how far it bleeds either side. */
const strokeReach = (width: number) => width / 2;

/**
 * The numbers out of an `hsl()` string, whichever separator style it uses —
 * space-separated, comma-separated, or with a `/ alpha`. Parsing loosely is the
 * point: a check that only understood one spelling would wave the others
 * through, which is how a stray hue once slipped past.
 */
const channels = (colour: string) => (colour.match(/-?[\d.]+/g) ?? []).map(Number);
const hueOf = (colour: string) => channels(colour)[0];
const lightnessOf = (colour: string) => channels(colour)[2];

const tiers = Object.values(ticks.tiers);

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

describe('the dial fits together', () => {
  it('nests everything drawn on the shaded face inside it', () => {
    for (const radius of [
      ...tiers.map((tier) => tier.inner),
      hourLabels.radius,
      markers.inner,
      markers.outer,
      hands.hour.length,
      hands.minute.length,
      hands.hub.radius,
    ]) {
      expect(radius).toBeGreaterThan(0);
      expect(radius).toBeLessThanOrEqual(face.radius);
    }
  });

  it('fits inside the viewBox, minute numerals and all', () => {
    expect(face.radius).toBeLessThan(canvas.extent);
    // Only half the glyph extends past the band's radius; allowing a whole font
    // size leaves the margin the outer band needs to not look clipped.
    expect(minuteLabels.radius + minuteLabels.size).toBeLessThanOrEqual(canvas.extent);
    // The knob's base is the outermost painted thing outside the minute band.
    expect(yearKnob.base).toBeLessThan(canvas.extent);
  });

  it('lengthens each tick tier in step with its emphasis', () => {
    // Longer tick = further in. Quarter-day anchors are longest, then the hours
    // carrying a numeral, then the plain ones.
    expect(ticks.tiers.quarter.inner).toBeLessThan(ticks.tiers.labelled.inner);
    expect(ticks.tiers.labelled.inner).toBeLessThan(ticks.tiers.plain.inner);
    // And draws the loudest one heaviest, so length and weight agree.
    expect(ticks.tiers.quarter.width).toBeGreaterThan(ticks.tiers.labelled.width);
    expect(ticks.tiers.labelled.width).toBeGreaterThan(ticks.tiers.plain.width);
  });

  it('keeps every tick tier inside the rim that paints over it', () => {
    // Ticks are drawn from `outer - width / 2` inward precisely so one bound
    // covers all three tiers. Measured from the centreline instead, the
    // 1.6-wide anchors reached 87.8 and poked through a rim ending at 87.5.
    expect(ticks.outer).toBeLessThanOrEqual(face.radius + strokeReach(face.rim.width));
    for (const tier of tiers) {
      // Still a tick after the cap compensation shortens it.
      expect(ticks.outer - strokeReach(tier.width)).toBeGreaterThan(tier.inner);
    }
  });

  it('keeps the ring inside its own silhouette', () => {
    // Each slice is stroked with its own fill, so the gradient bleeds half that
    // width past r=face. Wider than the rim and the fill spills outside it.
    expect(strokeReach(ring.sliceStrokeWidth)).toBeLessThanOrEqual(strokeReach(face.rim.width));
  });
});

describe("the reader's markers", () => {
  it('keeps the wedge band inside the hour numerals it must not tint', () => {
    // The load-bearing one. Everything the dial is read *against* — the
    // numerals, the ticks, the rim, both ink flips — sits outside this band, so
    // no marker can ever be part of the backdrop one of them was measured
    // against. Let the band past the numerals' glyph edge and every contrast
    // ratio in this file and in styles.css becomes a claim about an untinted
    // face that is no longer true.
    expect(markers.inner).toBeLessThan(markers.outer);
    expect(markers.outer).toBeLessThanOrEqual(hourLabels.radius - glyphReach(hourLabels.size, hourLabels.outlineWidth));
  });

  it('clears the corners of the readout box, not just its radius', () => {
    // The readout is a rectangle and the band is a circle, so the constraint is
    // the box's *corners*: measured against `bottom` alone the band would start
    // at 32 and cut through the ends of the longest line.
    const corner = Math.hypot(markers.readout.halfWidth, markers.readout.bottom);
    expect(markers.inner).toBeGreaterThanOrEqual(corner);
    expect(markers.readout.top).toBeLessThan(markers.readout.bottom);
  });

  it('leaves the hub and the counterweights out of the readout box', () => {
    // The tails' round caps paint a couple of units past the hub disc — see
    // `hands.tail` — so clearing `hub.radius` alone would put the first line of
    // text on top of them.
    const tailReach = hands.tail + strokeReach(hands.hour.width);
    expect(markers.readout.top).toBeGreaterThan(Math.max(hands.hub.radius + hands.hub.haloWidth, tailReach));
  });

  it('orders the four wedge opacities the way the eye reads them', () => {
    // Past recedes, upcoming sits mid-way, the one in progress is louder, and
    // the part of it still to come is loudest: the ranking *is* the readout, so
    // a mis-sorted pair would say the day was the other way round.
    const { past, upcoming, active, remaining } = markers.wedge;
    expect(past).toBeLessThan(upcoming);
    expect(upcoming).toBeLessThan(active);
    expect(active).toBeLessThan(remaining);
    expect(remaining).toBeLessThanOrEqual(1);
  });

  it('ranks the moment dashes the same way, on their own scale', () => {
    // Same order, higher values: a 1.2-unit dash at the wedges' opacities is
    // invisible where a 16-unit wedge is a wash, which is why these are separate
    // numbers rather than a reuse.
    expect(markers.moment.past).toBeLessThan(markers.moment.upcoming);
    expect(markers.moment.upcoming).toBeLessThan(markers.moment.active);
    expect(markers.moment.active).toBeLessThanOrEqual(1);
    expect(markers.moment.past).toBeGreaterThan(markers.wedge.past);
  });

  it('draws the next boundary as the crispest mark in the band', () => {
    // It is the one thing the countdown is counting down to, so nothing else
    // among the markers may out-weigh it.
    expect(markers.boundary.width).toBeGreaterThanOrEqual(markers.moment.width * 0.5);
    expect(markers.readout.detail.size).toBeGreaterThan(markers.readout.label.size);
  });
});

describe('the hands', () => {
  it('keeps the hour hand shorter than the minute hand, as on a 24h dial', () => {
    expect(hands.hour.length).toBeLessThan(hands.minute.length);
    // And heavier, which is the other half of telling them apart at a glance.
    expect(hands.hour.width).toBeGreaterThan(hands.minute.width);
  });

  it('stops the hour hand short of the numerals it points at, halo included', () => {
    const tip = hands.hour.length + strokeReach(hands.hour.width + hands.haloBleed);
    const numeralEdge = hourLabels.radius - glyphReach(hourLabels.size, hourLabels.outlineWidth);
    expect(tip).toBeLessThan(numeralEdge);
  });

  it('stops the minute hand short of the longest tick, halo included', () => {
    // The minute hand reads the outer band by angle rather than by reaching it,
    // so it gains nothing from running the full radius — and a tip that stops
    // before the quarter-day ticks avoids crowding them. This is the assertion
    // the old bare `>= 2` units of clearance was standing in for.
    const tip = hands.minute.length + strokeReach(hands.minute.width + hands.haloBleed);
    expect(tip).toBeLessThan(ticks.tiers.quarter.inner);
    // Still outside the hour numerals, so the two hands stay tellable apart.
    expect(hands.minute.length).toBeGreaterThan(hourLabels.radius);
  });

  it('keeps each counterweight within the hub it pivots on', () => {
    // Centreline only: the tail's round cap deliberately paints a couple of
    // units past the hub disc — see the note on `hands.tail`.
    expect(hands.tail).toBeLessThanOrEqual(hands.hub.radius);
  });
});

describe('the two numeral scales', () => {
  const labelledHours = [...Array(24).keys()].filter((h) => h % hourLabels.step === 0);
  const labelledMinutes = [...Array(60).keys()].filter((m) => m % minuteLabels.step === 0);

  it('divides both scales evenly, so no numeral is orphaned', () => {
    expect(24 % hourLabels.step).toBe(0);
    expect(60 % minuteLabels.step).toBe(0);
  });

  it('puts every labelled minute at the same angle as a labelled hour', () => {
    // Not a defect — a consequence of one circle carrying both scales at
    // different rates. Minute 10 sits at 60°, which is also hour 16; minute 30
    // sits at the bottom, which is also hour 0. This is the test that justifies
    // the radial separation asserted below: since the two scales cannot be told
    // apart by angle, radius has to do all of that work.
    const hourAngles = new Set(labelledHours.map((h) => turn(angleForHour(h))));
    for (const minute of labelledMinutes) {
      expect(hourAngles).toContain(turn(angleForMinute(minute)));
    }
  });

  it('separates the two scales by the whole tick band and the rim', () => {
    // Glyph edges, not centres: the hour numerals' outline has to clear the
    // longest tick, and the minute numerals have to clear the rim itself rather
    // than merely the face radius it straddles.
    expect(hourLabels.radius + glyphReach(hourLabels.size, hourLabels.outlineWidth)).toBeLessThan(
      ticks.tiers.quarter.inner,
    );
    expect(minuteLabels.radius - glyphReach(minuteLabels.size)).toBeGreaterThan(
      face.radius + strokeReach(face.rim.width),
    );
  });

  it("stands the knob's point on the dial's edge", () => {
    // Touching, not merely near. The daylight arc that used to occupy this
    // corridor had to read as *separate* from the rim and merged with it into a
    // doubled silhouette when it came within a unit; a filled triangle cannot be
    // mistaken for a second silhouette, so contact is safe here where proximity
    // was not — and contact is what makes the pointer read as part of the dial.
    expect(yearKnob.apex).toBe(face.radius + strokeReach(face.rim.width));
  });

  it('keeps the knob clear of the minute numerals', () => {
    // The other end of the corridor, measured against the glyphs' painted edge
    // rather than their nominal radius, for the reason the tests above give.
    expect(minuteLabels.radius - glyphReach(minuteLabels.size) - yearKnob.base).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps the knob taller than it is wide', () => {
    // At a 375px viewport this shape is about 4px by 3px, and that small it reads
    // as a pointer only while the point is the longest thing about it. Widen it
    // and it becomes a blob that could be anything.
    expect(yearKnob.base - yearKnob.apex).toBeGreaterThan(yearKnob.halfBase * 2);
  });

  it('gives the knob a target a finger can find', () => {
    // The knob is ~3px across at a 375px viewport, so the hit wedge is the whole
    // of its usability on touch. Wider than one day of arc in a leap year, or the
    // day under the finger would be unreachable.
    expect(yearKnob.hit.inner).toBeLessThan(yearKnob.apex);
    expect(yearKnob.hit.outer).toBeGreaterThan(yearKnob.base);
    expect(yearKnob.hit.halfAngleDeg).toBeGreaterThan(360 / 366 / 2);
  });

  it('gives every anchor tick a numeral to anchor', () => {
    // A tier drawn longest and heaviest but landing on an unlabelled hour would
    // read as emphasis pointing at nothing.
    expect(ticks.anchorStep % hourLabels.step).toBe(0);
  });

  it('sets minute numerals smaller and lighter than hour numerals', () => {
    expect(minuteLabels.size).toBeLessThan(hourLabels.size);
    expect(minuteLabels.weight).toBeLessThan(hourLabels.weight);
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

  it('keeps every literal colour on the palette hue, bar the pinned accent', () => {
    // Saturation deliberately varies — 12% for the ramp and the ink, 14% for
    // the hand core — but a stray hue would break the monochrome scale. Matches
    // `hsla(` as well as `hsl(`, so a change of spelling cannot dodge the check.
    const literals = colours.filter((leaf) => String(leaf.value).startsWith('hsl'));
    expect(literals.length).toBeGreaterThan(0);
    for (const { path, value } of literals) {
      const allowed = path === 'markers.accent' ? palette.accentHue : palette.hue;
      expect(hueOf(String(value)), path).toBe(allowed);
    }
  });

  it("spends the accent hue on the reader's markers and nothing else", () => {
    // Exact equality, like the themed-token check above and for the same reason:
    // the accent exists to say "this mark is yours, not the sun's", and it can
    // only say that while it is the one thing wearing it. A second use has to be
    // argued for here first.
    const accented = colours
      .filter((leaf) => String(leaf.value).startsWith('hsl') && hueOf(String(leaf.value)) === palette.accentHue)
      .map((leaf) => leaf.path);
    expect(accented).toEqual(['markers.accent']);
  });

  it('puts the accent well away from the palette hue on the wheel', () => {
    // Close hues read as a bad match rather than as a distinction, and the
    // distinction is the entire job: half a wheel apart, nothing on the face can
    // be mistaken for a marker.
    const apart = Math.abs(palette.accentHue - palette.hue) % 360;
    expect(Math.min(apart, 360 - apart)).toBeGreaterThan(120);
  });

  it('maps lightness onto an ordered band inside HSL range', () => {
    expect(palette.band.min).toBeLessThan(palette.band.max);
    expect(palette.band.min).toBeGreaterThanOrEqual(0);
    expect(palette.band.max).toBeLessThanOrEqual(100);
  });

  it('spans the ramp with the hour numeral tones', () => {
    // Whichever end of the ramp a numeral lands on, one tone has to be far from
    // it — that is what lets the flip always have a solid fill to reach for.
    // Let the pair converge and the halo becomes decoration, handing legibility
    // back to the gradient: a ~3.5:1 dip through the civil-twilight band.
    const dark = lightnessOf(hourLabels.inkDark);
    const light = lightnessOf(hourLabels.inkLight);

    expect(hourLabels.inkDark).not.toBe(hourLabels.inkLight);
    expect(light - dark).toBeGreaterThanOrEqual(60);
    expect(dark).toBeLessThan(palette.band.min + 15);
    expect(light).toBeGreaterThan(palette.band.max - 15);
  });

  it("flips both inks inside the ramp's transition, not on a plateau", () => {
    // The ramp is flat at `NIGHT_LIGHTNESS` and below, and flat at 1 above
    // `FULL_LIGHT_DEG`; everything between is transition. A flip has to land in
    // that transition: it exists to serve the mid-tones, where contrast against
    // the face is weakest. Put it outside and the ink is effectively
    // single-toned across the whole lit or whole dark part of the day, with
    // 0.99 (light-on-light nearly all the way round) being the failure this
    // catches.
    for (const flipAt of [ticks.ink.flipAt, hourLabels.flipAt]) {
      expect(flipAt).toBeGreaterThan(NIGHT_LIGHTNESS);
      expect(flipAt).toBeLessThan(1);
    }
    expect(ticks.ink.dark).not.toBe(ticks.ink.light);
  });

  it('puts both ink flips within minutes of sunrise and sunset', () => {
    // Stronger than "inside the transition", and the reason the narrow ramp is
    // worth having: the altitude at which each ink flips should be the horizon,
    // so a numeral changes tone as the sun crosses it rather than somewhere
    // arbitrary in dusk. Solved by bisection on the real ramp so this follows a
    // retune of either module instead of restating its arithmetic.
    for (const flipAt of [ticks.ink.flipAt, hourLabels.flipAt]) {
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
