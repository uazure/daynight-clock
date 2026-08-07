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
   * The two blocks of text at the hub — the digital clock above it and the
   * marker countdown below — and the one thing they share: the pair of tones
   * they flip between.
   *
   * They are the only text on the dial that cannot lean on the shading the way
   * the numerals do. Out at `hourLabels.radius` a glyph covers about an hour of
   * arc and sits on one tone; near the centre the ring's 1440 slices have
   * converged, so a block of text spans hours of the day at once.
   *
   * Two mechanisms answer that together, and both are needed. Each glyph is
   * stroked with the *other* tone underneath its own fill
   * (`paint-order: stroke`), so it reads against its outline rather than
   * against the face. And the pair **swaps** at `flipAt`, so the fill is
   * always the tone far from the backdrop rather than the tone near it.
   *
   * The halo alone was what this used to do, and it is not enough: a light fill
   * over a near-white face has no contrast against it, and the glyph reads as a
   * hollow outline. That is the countdown's behaviour through a polar day, and
   * it is what the digital block would do every day of the year, sitting as it
   * does over the noon fan.
   *
   * Range for the pair: both on `palette.hue`, `dark` lightness ≤15, `light`
   * ≥90, and at least 60 apart — the same bracket `hourLabels`' pair is pinned
   * to, and for the same reason. Let them converge and the flip has no solid
   * fill to reach for.
   */
  hubText: {
    dark: 'hsl(220 14% 10%)',
    /**
     * Deliberately `palette.band.max` exactly, so over full daylight the halo
     * is the *same tone as the face behind it* and disappears. At 92% it read
     * as a grey rim tracing every glyph on a near-white dial — visible
     * furniture doing no work, since on that backdrop the dark core carries
     * the glyph by itself. The halo is still there and still load-bearing in
     * the other three cases: over the night fan (where it is the dark tone
     * under a light core), through twilight, and wherever a hand passes
     * beneath the block. Range: 92–96, and 96 only holds while it matches
     * `palette.band.max`; raise the band and this follows it.
     */
    light: 'hsl(220 12% 96%)',
    /**
     * Where the pair swaps, on the 0..1 lightness scale. Range: 0.4–0.6, and
     * pinned by `visual.test.ts` to land within a quarter degree of the
     * horizon — a block of text should change tone as the sun crosses it, the
     * same as the ticks and the numerals do.
     */
    flipAt: 0.5,
    /**
     * How much of the day each block's backdrop is meaned over, either side of
     * its own hour — see `meanLightnessAround`.
     *
     * The glyphs' widest point is the box's inner corner: at (±21, 10) that is
     * `atan(21/10) ≈ 64°` from the vertical, or 4.3 h either side, and at
     * (±21, 21) it is 45°, or 3 h. 3.5 is the middle of what is actually behind
     * them. Range: 2–4.5. Past ~4.5 the mean starts taking in dawn and dusk,
     * out at hours 6 and 18, which are behind neither block.
     */
    flipSpanHours: 3.5,
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
    /** Inner edge of the wedge band. Range: ≥ the readout box's corner radius, √(28² + 32²) ≈ 42.5. */
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
     * lightness ≤15, and ≥60 below `halo` (checked).
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
     * viewport); opacities 0.2–1, ascending in the wedge order.
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
     * The countdown at the hub, in the disc the wedge band leaves free —
     * **everything about how it looks, in both of the forms it takes.**
     *
     * `MarkerReadout` is the only thing that draws it, and it reads only this
     * block, so every value here is live in one of the two states below and
     * editing one of them changes what is on screen. That is worth saying
     * because it briefly was not true: the compact form's numbers lived under
     * `VISUAL.digital` for a while, which left this block looking like the
     * place to tune the countdown while the line on screen came from
     * somewhere else.
     *
     * **The full form** — `label` over `detail`, two lines — is what the
     * countdown is when it has the disc to itself, which is when the digital
     * clock is switched off. Its ink is `hubText`'s pair, flipped against the
     * mean lightness of the hours this box spans; see that block for why text
     * at this radius needs both a halo and a flip.
     *
     * **The compact form** is what it becomes when the clock is shown, since
     * the clock and the date take the room the two lines used. See `compact`.
     */
    readout: {
      /** The box the text must stay inside; it is what sets `inner` above. Range: fixed unless `inner` moves with it. */
      halfWidth: 28,
      top: 10,
      bottom: 32,
      /** Stroked under the fill, so the glyph reads against its own outline. Range: 1.0–2.0. */
      haloWidth: 1.4,
      /**
       * The two lines: `label` names what is next, `detail` says how long. Range:
       * size 4.5–10 and equal or ascending label → detail; `y` must keep both
       * inside `top`…`bottom`; `detail.weight` ≥ `label.weight`, since the
       * duration is the thing being read.
       */
      label: { y: 19, size: 5, weight: 400, color: 'hsl(220 12% 72%)' },
      detail: { y: 25.5, size: 5, weight: 500, color: 'hsl(220 12% 72%)' },
      /**
       * The countdown as one grey line under the digital clock —
       * `Break starts in 1h 45m` — instead of the two above.
       *
       * One line, and this is what sets `size`. `readoutLines` can produce a
       * `MAX_LABEL_LENGTH` label plus `' starts'` plus `' in 1h 45m'` — 27
       * characters, the `Meditation starts in 1h 45m` case — and system-ui
       * averages ~0.52em a character, so 27 of them come to ~56 units at size
       * 4 and no larger size fits. That is under the ~5-unit floor the rest of
       * the dial keeps to, which is the price of being a third line; it is
       * also why this form is a caption rather than something the dial expects
       * to be read at a glance. Range: 3.8–4.2.
       *
       * `halfWidth` is its own and wider than the block's, because this line
       * sits further down the disc and the bound is the corner:
       * `hypot(29, 31.2) ≈ 42.6`, still inside `markers.inner`. Range: ≤ 29.
       *
       * **`y` has a hard ceiling of 30.9**, and it is the corner that sets it,
       * not the box: the descender lands at `y + 0.21 * size`, and
       * `hypot(halfWidth, descender)` has to stay inside `markers.inner` (43),
       * which gives 30.91 against the 31.16 `outer` alone would allow. Push it
       * to 32 and the ends of a long line cross into the wedge band. Nothing
       * checks this for you — see the note at the top of `visual.test.ts` on
       * why the geometry pins are gone — so the arithmetic is here instead.
       *
       * `color` is grey rather than either tone of `hubText` on purpose — it
       * is the one line here that should recede under the clock. Fixed rather
       * than flipped, matching the stack it belongs to. Range: on
       * `palette.hue`, lightness 60–80: above ~80 it stops reading as
       * subordinate to the clock, below ~60 it disappears into the night fan
       * it sits on.
       */
      compact: { y: 36, size: 4, weight: 400, halfWidth: 29, haloWidth: 0.5, color: 'hsl(220 12% 72%)' },
    },
  },

  /**
   * The digital clock and today's date, in the free disc *below* the hub.
   *
   * **The countdown that sits under them is not here** — it is
   * `markers.readout.compact`, because `MarkerReadout` draws it in both of the
   * forms it takes and one block should own how it looks. What this block owes
   * that one is room: the three lines share a stack, so `time` and `date`
   * are what decide whether the caption still fits.
   *
   * **Below rather than above, because of where the hands park.** Both hands
   * spend the readable part of the day in the upper half — the hour hand
   * crosses the noon slot from about 07:30 to 16:30, which is exactly when
   * someone glances at a clock — and up there they also cross the hour
   * numerals. The lower slot is swept only from about 19:30 to 04:30. An
   * earlier arrangement put the digits above the hub and the countdown below;
   * it read as crowded, because the block competed with the hands and the
   * numerals at once.
   *
   * All three lines therefore share one stack, which is what forces the
   * countdown onto a single line: four lines of type do not fit between
   * `inner` and `outer` — the fourth lands past 36 against a ceiling of 32.6.
   * That is also why the countdown is the one line drawn in grey. It is a
   * caption under the clock now, not a readout of its own.
   *
   * **Every distance here is a downward distance from the hub**, which on this
   * dial is already the positive direction, so unlike most of this file
   * nothing is negated at the call site. `inner` and `outer` name the near and
   * far edges rather than a top and a bottom, so the sign convention holds
   * whichever side of the hub a block ends up on.
   *
   * Its ink is **fixed, not flipped**: `hubText.light` over `hubText.dark`.
   * This block sits over the midnight fan, which is the dark end of the ramp
   * on all but a polar day, so a light fill is right essentially always and
   * the black outline is what carries it through the exception. That is a
   * deliberate difference from `markers.readout`, which still flips — see the
   * note on `hubText`.
   */
  digital: {
    /**
     * The box the time and date must stay inside. Range: equal to
     * `markers.readout.halfWidth` — both blocks are bounded by `markers.inner`,
     * so one corner bound serves both.
     */
    halfWidth: 28,
    /**
     * The near edge, below the hub. Range: > `hands.tail + hands.hour.width/2`
     * (7.7). The counterweights' round caps paint a couple of units past the
     * hub disc, so clearing `hands.hub.radius` alone puts the digits on them.
     */
    inner: 9.5,
    /**
     * The far edge. Range: `hypot(halfWidth, outer)` must stay ≤ `markers.inner`
     * (43), which at halfWidth 28 caps this at ~32.6.
     */
    outer: 32,
    /**
     * The clock. `y` is a distance below the hub, so the cap top lands at
     * `y - size * 0.72` and must stay outside `inner`.
     *
     * Range: size 10–13, and above `hourLabels.size` (9) — it is the one thing
     * on this face meant to be read before anything else. 13 was the size
     * while this block had the disc to itself; sharing the disc with the
     * countdown costs it a unit, since every unit here pushes three lines
     * down at once. The other ceiling is width: `10:44` is ~2.48em and `12:44`
     * plus a small meridiem is ~3.3em, so past ~14 the 12-hour string runs out
     * of a 56-unit box. Weight 400–600.
     *
     * `haloWidth` range: 1.0–1.8. Far lighter than a linear scale off the
     * countdown's 1.4 on 5-unit type would give: a stroke that grows with the
     * glyph closes up the counters of the digits, and at 2.2 it visibly ate
     * notches out of any hand passing beneath the block.
     */
    time: { y: 22, size: 12, weight: 500, haloWidth: 1.3 },
    /**
     * The date under it, deliberately subordinate. `y` is a distance below the
     * hub and so *larger* than `time.y`; the descender at `y + size * 0.21`
     * must leave room for the countdown beneath it.
     *
     * Range: size 4.5–6. 4.8 is ~8.2px at a 375px viewport, just under the
     * floor `minuteLabels.size` sits at. Weight strictly under `time.weight`.
     * `haloWidth` range: 0.7–1.4 — at this size a 1.4 outline is a quarter of
     * the glyph and thickens the line into a smudge.
     */
    date: { y: 27, size: 4.5, weight: 300, haloWidth: 0.5 },
    /**
     * The `AM`/`PM` suffix under the 12-hour preference, drawn as a smaller
     * `<tspan>` in the same `<text>` so `text-anchor: middle` centres the whole
     * advance, gap included, with no offset computed by hand.
     *
     * Range: 4.5–7 and well under `time.size`. At `time.size` the suffix does
     * not quite overflow — it leaves about a unit — but these widths are
     * estimates for a `system-ui` stack that resolves to Segoe UI on Windows,
     * SF on macOS and Roboto on Android, and no node test can measure SVG text
     * to check one. A unit is not a margin. A full-size suffix also makes the
     * hero read as eight glyphs rather than as a time.
     *
     * `gap` is a `dx` rather than a space character: SVG collapses leading
     * whitespace in a `<tspan>` by default, so a typed space is not reliably
     * there. Range: 1–2.
     */
    meridiem: { size: 5.5, gap: 1.4 },
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
