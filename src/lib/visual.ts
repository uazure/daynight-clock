/**
 * Every visual decision the dial makes, in one place. Tweak the dial's
 * appearance here and nowhere else.
 *
 * **Units** are viewBox units, never pixels. The viewBox is
 * `-extent -extent 2*extent 2*extent`, so 0 is the dial's centre and `extent`
 * reaches the edge of the box. The whole dial scales with the box `.clock` gets,
 * which makes these effectively the mobile sizes too: a 375px viewport renders
 * ~1.7px per unit, so **1 unit ≈ 1.7px at the smallest size that matters**. Any
 * mark under ~0.5 units disappears there, and any type under ~5 units is
 * unreadable.
 *
 * **Colours.** A literal `hsl()` is theme-independent; a `var(--…)` follows the
 * theme. Only three tokens may be `var(--…)`, and each paints on or outside the
 * face's edge where the backdrop really is the page: `face.rim.color`,
 * `minuteLabels.fill`, `yearKnob.color`. Everything else lands on the day/night
 * gradient and must not move when the theme does. Every literal is on
 * `palette.hue` — the markers included, since they separate from the face by
 * inversion (`markers.blend`) rather than by a hue of their own. `visual.test.ts`
 * pins both rules by exact equality, so a fourth token or a second hue has to be
 * argued for there first.
 *
 * **This module imports nothing** — `lightness.ts` imports it and `sun.ts`
 * imports that, so staying a leaf makes an import cycle impossible. Values that
 * would have to come from another module (the slice arc, which follows
 * `SAMPLES_PER_DAY`) are derived at their call site instead.
 *
 * No font family is set anywhere on the dial; the SVG inherits the page's
 * `system-ui` stack from `styles.css`.
 */
export const VISUAL = {
  /** Half the viewBox; the unit everything else is measured in. Range: fixed at 100 — changing it rescales the dial. */
  canvas: { extent: 100 },

  face: {
    /** Radius of the shaded day/night disc. Most other radii are relative to it. Range: 80–90. */
    radius: 87,
    /**
     * The dial's silhouette, on the face's edge and painted above the ticks so
     * their caps cannot notch it. Range: 0.5–1.5 — heavier reads as another tick
     * tier, and the colour's contrast ratios in `styles.css` assume a hairline.
     */
    rim: { color: 'var(--dial-outline)', width: 1 },
  },

  palette: {
    /** Base hue for the whole monochrome dial. Range: any 0–359; repeated by hand in every literal below. */
    hue: 220,
    /** Saturation of the day/night ramp. Range: 0–20 — higher stops reading as a luminance scale. */
    saturation: 12,
    /**
     * HSL lightness range the 0..1 shading maps onto. Range: min 3–8, max 92–97.
     * Editing either invalidates the contrast ratios noted in `styles.css`, which
     * were measured against 96%, the ~13.2% night plateau and the ~8.6% floor.
     */
    band: { min: 5, max: 96 },
  },

  ring: {
    /** Angular overlap between the 1440 slices, hiding antialiasing seams. Range: 0.2–0.6. */
    sliceOverlapDeg: 0.4,
    /**
     * Each slice is also stroked in its own fill, covering the gaps that
     * converge on the hub. Range: 0.3–1.0, and at or below `face.rim.width` —
     * past that the gradient spills outside the silhouette.
     */
    sliceStrokeWidth: 0.6,
  },

  ticks: {
    /**
     * Tick ink. Ticks are the one element that flips tone with the shading behind
     * it — a 0.5-wide hairline is too thin to carry a halo, so it must contrast
     * with the face directly. `flipAt` is a position on the 0..1 lightness scale,
     * not a colour: below it the tick switches to `light`. Range: keep the pair far
     * apart in lightness (here 12% vs 92%); `flipAt` 0.4–0.6.
     */
    ink: { dark: 'hsl(220 12% 12%)', light: 'hsl(220 12% 92%)', flipAt: 0.5 },
    /** Hours per quarter-day anchor tick. Range: must be a multiple of `hourLabels.step`. */
    anchorStep: 6,
    /**
     * Radius every tick's *painted* tip lands on, round cap included; ticks are
     * drawn from `outer - width/2` inward so all tiers end on one circle. Range:
     * ≤ `face.radius`, or the longest tier pokes through the rim.
     */
    outer: 87,
    /**
     * Three tiers of emphasis. `inner` is where the tick starts, so **smaller
     * means longer means louder**. Range: 70–85, strictly increasing
     * quarter → labelled → plain; widths 0.4–2.0, strictly decreasing.
     */
    tiers: {
      quarter: { inner: 73, width: 1.7 },
      labelled: { inner: 77, width: 1 },
      plain: { inner: 80, width: 0.5 },
    },
  },

  /**
   * Hour numerals, *inside* the face.
   *
   * The two numeral scales share angles — the minute hand turns 24× faster, so
   * every labelled minute sits at exactly the same angle as a labelled hour
   * (minute 10 with hour 16, minute 30 with hour 0). Angle cannot tell them
   * apart, so radius must: hours inside the face, minutes on a band outside it.
   * `visual.test.ts` pins that separation.
   */
  hourLabels: {
    /** Hours carrying a numeral. Range: 1–3; 2 gives 12 numerals, which is uncrowded at this radius. */
    step: 2,
    /** Range: 55–70, and must leave `size/2` of clearance inside `markers.outer`. */
    radius: 64,
    /** Range: 7–11. Below ~7 it is unreadable at a 375px viewport. */
    size: 9,
    /** Range: 400–600. */
    weight: 500,
    /**
     * Two tones that trade places at `flipAt`: whichever contrasts with the face
     * becomes the fill, the other is available to stroke underneath as a halo.
     * The flip is what keeps the glyph *solid* — one fixed pair cannot win at both
     * ends of the ramp, it goes hollow at whichever end it does not suit.
     *
     * **`outlineWidth` is 0, so no halo is painted.** The mechanism stays wired up
     * because a non-zero value is the one knob that fixes the flip if the mid-tones
     * either side of it ever get wide enough to matter, and a zero-width stroke
     * costs nothing. Range: 0, or 0.4–1.0 if it is ever needed.
     */
    inkDark: 'hsl(220 12% 12%)',
    inkLight: 'hsl(220 12% 92%)',
    flipAt: 0.5,
    outlineWidth: 0,
  },

  /** Minute numerals, on a band *outside* the face — so on the page, hence a themed fill. */
  minuteLabels: {
    /** Minutes carrying a numeral: 00, 05 … 55. Range: 5, 10 or 15. */
    step: 5,
    /**
     * Range: 92–95. Moved out from 93 to open the corridor the year knob now uses;
     * at 93 a mark in that corridor had 0.8 units either side and merged with the
     * rim into a doubled silhouette. Upper bound is the viewBox: `radius + size`
     * must stay under `canvas.extent`.
     */
    radius: 94,
    /** Range: 4.5–6. Already only ~8.5px at a 375px viewport, so this is the floor. */
    size: 5,
    /** Range: 300–400, and lighter than `hourLabels.weight` — these stay subordinate. */
    weight: 300,
    fill: 'var(--minute-ink)',
  },

  /**
   * The knob that scrubs the shading to another date — the whole of the year
   * scale, and deliberately its only mark. Opt-in; see `loadShowYearKnob`.
   *
   * 1 January sits at `angleForHour(0)`, the bottom of the dial, so the year and
   * the day share an origin. That alignment is `year.ts`'s business; nothing here
   * knows a date.
   *
   * It had a track and twelve month marks, and both are gone: months are 30 ± 1
   * days, so twelve month angles land within a degree of the twelve five-minute
   * numerals just outside them and read as ticks belonging to the minute scale.
   */
  yearKnob: {
    /**
     * The point, and the inner end of the shape. Range: exactly
     * `face.radius + rim.width/2` (87.5) — it touches the rim on purpose, so the
     * pointer reads as attached to the dial rather than floating beside it.
     * `visual.test.ts` pins the equality.
     */
    apex: 87.5,
    /**
     * The rounded outer end. Range: 89–90.5 — must keep ≥0.5 clear of the minute
     * glyphs' inner edge (`minuteLabels.radius - size/2` = 91.5).
     */
    base: 89.6,
    /** Half the width at the base. Range: 0.6–1.2, and less than `(base - apex)/2` — taller than wide, or it reads as a blob rather than a pointer. */
    halfBase: 0.9,
    color: 'var(--year-knob)',
    /**
     * The invisible grab target, a wedge travelling with the knob. It is far
     * larger than the knob because the knob is ~4px at a 375px viewport. Range:
     * `inner` < `apex`, `outer` > `base`, `halfAngleDeg` 4–10 — above ~10 a stray
     * tap near the dial's edge starts changing the date.
     */
    hit: { inner: 84, outer: 92.5, halfAngleDeg: 6 },
  },

  /**
   * The reader's own times: up to five moments or intervals, tinting the face
   * itself rather than taking a ring of their own.
   *
   * Two constraints shape this block. **The band stays inside 59** so that
   * nothing the dial is read *against* — hour numerals from 59.5 outward, ticks,
   * rim, both ink flips — ever has a tinted backdrop; a full-face wedge would
   * invalidate every contrast ratio measured for them at a stroke. And **every
   * mark carries its own contrast**, because a tint has to survive a ramp
   * running L96% to L5% and no single lightness can: dark over daylight is
   * light over night. So each mark is both — a `core` fill under a `halo`
   * edge, the recipe the hands use — and whichever sector it crosses, one half
   * of the pair is far from the face behind it. Over day the dark fill is the
   * mark and the light edge vanishes into the face; over night the fill
   * vanishes and the edge is the mark; at twilight both are partial, but the
   * pair never fails together.
   */
  markers: {
    /** Inner edge of the wedge band. Range: ≥ the readout box's corner radius, √(28² + 32²) ≈ 42.5. Pinned. */
    inner: 43,
    /** Outer edge of a *single* lane, and the lane height. Range: 45–52. */
    outer: 47,
    /**
     * Hard outer bound for the outermost lane when overlapping markers stack.
     * Range: ≤ `hourLabels.radius - size/2` (59.5) — past it the wedges reach the
     * hour numerals and every contrast ratio measured for those against an
     * untinted face stops being true. `laneBand` shrinks lane height to land here
     * exactly rather than overrun it.
     */
    maxOuter: 59,
    /** Air between stacked lanes, so two abutting wedges read as two. Range: 0.4–1.0. */
    laneGap: 1,
    /**
     * The dark half of every mark: what wedges fill with and radial marks stroke
     * with. Deliberately the same value as `hands.core` — the marks and the
     * hands are the two things drawn *on* the ramp that must read anywhere on
     * it, and they solve it with the same pair. Range: on `palette.hue`,
     * lightness ≤15, and ≥60 below `halo` (pinned).
     */
    core: 'hsl(220 14% 10%)',
    /**
     * The light half: a hairline on a wedge's outline, an underline beneath a
     * radial mark. Range: on `palette.hue`, lightness ≥90.
     */
    halo: 'hsl(220 12% 96%)',
    /**
     * The halo rails along a wedge's two arc edges — its arcs only, never its
     * radial ends, which stroked read as start/end ticks nothing put there.
     * An opacity scale of its own, because over the night sector the fill is
     * dark on dark and the rails are the whole mark: at the fill opacities
     * below they would barely exist, the same reason the moments have their own
     * scale. Range: width 0.3–0.8 (under ~0.3 it disappears at a 375px
     * viewport); opacities 0.2–1, ascending in the wedge order (pinned).
     */
    edge: { width: 0.3, past: 0.3, upcoming: 0.5, active: 0.7, remaining: 1 },
    /**
     * Fill opacity per phase, which is how emphasis is carried — one grey for
     * all five markers, told apart by position and by the readout naming the
     * next. `active` is only the *elapsed* part of a block in progress and
     * `remaining` the rest of it; they are separate wedges, never stacked.
     * Range: 0.1–0.7, ascending past → upcoming → active → remaining.
     */
    wedge: { past: 0.13, upcoming: 0.26, active: 0.34, remaining: 0.62 },
    /**
     * A moment has no arc to sweep, so it draws as a radial dash — and needs its
     * own opacity scale, since a 1.2-unit dash at 0.13 is invisible where a
     * 16-unit wedge at 0.13 is a wash. Range: width 0.8–2, opacities 0.3–1.
     */
    moment: { width: 0.3, past: 0.4, upcoming: 0.8, active: 1 },
    /** The next boundary, at full strength across the band. Range: 0.6–1.2, and ≥ `moment.width` — it is the crispest mark there. */
    boundary: { width: 0.3 },
    /**
     * The countdown at the hub: two lines, centred, in the disc the wedge band
     * leaves free.
     *
     * Text here cannot lean on the shading the way the numerals do — the ring's
     * slices all converge at the centre, so a glyph sits over a fan of every
     * lightness in the day at once and no fill can be chosen against it. Each
     * glyph is stroked with `halo` *underneath* its own fill
     * (`paint-order: stroke`) instead, so it reads against its outline and the
     * backdrop stops mattering. That is why `color` can be a plain light ink.
     */
    readout: {
      /** The box the text must stay inside; it is what sets `inner` above. Range: fixed unless `inner` moves with it. */
      halfWidth: 28,
      top: 10,
      bottom: 32,
      /**
       * Ink for both lines. **Deliberately not `markers.ink`**: that grey only
       * works through `blend`, and blended text would shift shade with whatever
       * the ramp puts behind each glyph. The halo is what makes a plain light
       * ink viable here instead. Range: on `palette.hue`, and light enough to
       * carry against `halo` — 85–96.
       */
      color: 'hsl(220 12% 92%)',
      /** Stroked under the fill, so the glyph reads against its own outline. Range: lightness ≤15; width 1.0–2.0. */
      halo: 'hsl(220 14% 10%)',
      haloWidth: 1.4,
      /**
       * The two lines: `label` names what is next, `detail` says how long. Range:
       * size 4.5–10 and equal or ascending label → detail; `y` must keep both
       * inside `top`…`bottom`; `detail.weight` ≥ `label.weight`, since the
       * duration is the thing being read.
       */
      label: { y: 19, size: 5, weight: 400 },
      detail: { y: 25.5, size: 5, weight: 500 },
    },
  },

  hands: {
    /** Range: lightness ≤15 — near-black, and the halo is what keeps it visible over the night sector. */
    core: 'hsl(220 14% 10%)',
    /** Range: lightness ≥90, alpha 0.4–0.7. */
    halo: 'hsl(220 12% 96% / 0.55)',
    /** How far the halo bleeds past the core it backs. Range: 0.6–1.5. */
    haloBleed: 1,
    /**
     * Counterweight length behind the centre. Its own value rather than shared
     * with `hub.radius`, so enlarging the hub does not also lengthen both tails.
     * Range: 4–8; note the round cap paints ~2 units past the hub disc, which is
     * the intended look.
     */
    tail: 6,
    /** Range: length 45–60 and shorter than `minute.length`; width 2.5–4. */
    hour: { length: 55, width: 3.4 },
    /** Range: length 65–73 — stops just inside `ticks.tiers.quarter.inner` (73), since the angle is what is read, not the tip; width 1–2. */
    minute: { length: 70, width: 1.4 },
    /** Range: radius 4–8; haloWidth 0.6–1.5. */
    hub: { radius: 6, haloWidth: 1 },
  },
} as const;
