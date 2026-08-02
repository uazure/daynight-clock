/**
 * Every visual decision the dial makes, in one place. Tweak the dial's
 * appearance here and nowhere else.
 *
 * Radii, type sizes and stroke widths are all in viewBox units. The viewBox is
 * `-extent -extent 2*extent 2*extent`, so the origin is the dial's centre and
 * `extent` units reach the edge of the box. Nothing here is in pixels — the
 * whole dial scales with whatever box `.clock` is given, which also makes these
 * the mobile sizes: a 375px-wide viewport renders the dial at ~343px, i.e.
 * 1.7px per unit. That is what stops the minute numerals going any smaller —
 * they are already only ~9px there — rather than crowding on their band, which
 * has room to spare.
 *
 * Three conventions hold throughout:
 *
 * - **This module imports nothing.** `lightness.ts` imports it and `sun.ts`
 *   imports that, so staying a leaf makes an import cycle impossible from
 *   anywhere. Values derived from other modules (the slice arc, which follows
 *   `SAMPLES_PER_DAY`) belong at their call site instead.
 * - **A literal `hsl()` is theme-independent; a `var(--…)` is not.** The theme
 *   switches page chrome, never the dial, so night stays dark and day stays
 *   bright in both. The only two exceptions paint *on* or *outside* the face's
 *   edge, where the backdrop genuinely is the page rather than the day/night
 *   gradient: the rim and the minute numerals. `visual.test.ts` enforces that
 *   split, which is the one automated check on that rule.
 * - **`palette.hue` is repeated by hand in every literal below**, so changing
 *   `hue` on its own retints the gradient and nothing else. A test checks the
 *   literals still agree with it — hue only, because the saturations differ
 *   deliberately (12% for the ramp and the ink, 14% for the hand core and the
 *   rim, all of them measured against the ramp rather than guessed). One literal
 *   is on `palette.accentHue` instead, and that exception is pinned to a single
 *   path by the same test: the reader's markers are the one thing on the dial
 *   that is not the sun's doing, and hue is what says so.
 *
 * No font family is set anywhere on the dial; the SVG inherits the page's
 * `system-ui` stack from `styles.css`.
 */
export const VISUAL = {
  /** Half the viewBox. Everything below is measured from the centre outward. */
  canvas: { extent: 100 },

  /** The shaded day/night disc; most other radii are measured against it. */
  face: {
    radius: 87,
    /**
     * The dial's silhouette, painted on the face's edge and — deliberately —
     * *above* the ticks, so their round caps cannot notch it. A near-black
     * stroke once disappeared through the night sector and for the whole of a
     * polar night, which is why the colour is a mid-tone token rather than
     * black; the value and its measured contrast ratios live with the other
     * theme tokens in `styles.css`. Keep it a hairline: those ratios are
     * measured for one, and a heavier rim reads as another tick tier.
     */
    rim: { color: 'var(--dial-outline)', width: 1 },
  },

  /**
   * The monochrome base the day/night gradient is built from — a single hue, so
   * the face reads as one luminance scale rather than a colour wheel. `band`
   * is the HSL lightness range that `lightnessToFill` maps 0..1 onto.
   *
   * Editing `band` invalidates the contrast ratios written next to
   * `--dial-outline` and `--minute-ink` in `styles.css`; those were measured
   * against 96% at the bright end, ~13.2% at the night plateau
   * (`NIGHT_LIGHTNESS`) and ~8.6% at the deep-night floor (`NIGHT_FLOOR`, the
   * lowest the ramp actually reaches — 0.04 rather than 0). Moving either of
   * those two ramp constants invalidates them just as surely as moving `band`.
   */
  palette: {
    hue: 220,
    /**
     * The one hue on the dial that is not `hue`, and the only thing wearing it
     * is the reader's own markers — see the `markers` block below for why a
     * saturated mark is the only kind that survives both ends of the ramp, and
     * `visual.test.ts` for the allowlist that keeps it to that one use.
     *
     * 38° against the base 220° is very nearly opposite it on the wheel, which
     * is the point: nothing on the face can be mistaken for a marker and no
     * marker can be mistaken for dial furniture.
     */
    accentHue: 38,
    saturation: 12,
    band: { min: 5, max: 96 },
  },

  ring: {
    /** Slices overlap in angle so antialiasing leaves no hairline seams. */
    sliceOverlapDeg: 0.4,
    /**
     * Each slice is also stroked with its own fill, so the painted shape
     * extends past its geometric edge and covers the anti-aliased gap between
     * neighbours — and the many wedge edges converging on the hub — rather
     * than relying on angular overlap alone. Keep it at or below the rim's
     * width, past which the gradient spills outside the silhouette.
     */
    sliceStrokeWidth: 0.6,
  },

  ticks: {
    /**
     * Ticks are the one dial element that still flips tone with the shading
     * behind it: a 0.5-wide hairline is too thin to carry an outline the way
     * the numerals do, so it has to contrast with the face directly. `flipAt`
     * is a position on the 0..1 lightness scale, not a colour — below it the
     * tick switches to `light`.
     */
    ink: { dark: 'hsl(220 12% 12%)', light: 'hsl(220 12% 92%)', flipAt: 0.5 },
    /** Hours per quarter-day anchor — the coarsest tier, and easiest to find. */
    anchorStep: 6,
    /**
     * The radius a tick's *painted* tip lands on, round cap included. Ticks are
     * drawn from `outer - width / 2` inward so every tier ends on the same
     * circle; measuring from the centreline instead made each tier overshoot by
     * a different amount and poke through the rim.
     */
    outer: 87,
    /**
     * Three tiers of emphasis, named for the role each plays rather than for a
     * number of hours — the middle tier is selected by `hourLabels.step`, so
     * "every 2h" would become a lie the moment that changed. `inner` is where
     * the tick starts: smaller means longer, so a longer tick is a louder one.
     */
    tiers: {
      quarter: { inner: 73, width: 1.7 },
      labelled: { inner: 77, width: 1 },
      plain: { inner: 80, width: 0.5 },
    },
  },

  /**
   * The dial carries two numeral scales on one circle, and because the minute
   * hand turns 24 times faster than the hour hand they share angles: every
   * labelled minute sits at exactly the same angle as a labelled hour (minute
   * 10 with hour 16, minute 30 with hour 0, and so on). Angle therefore cannot
   * tell them apart and radius has to — hence hours *inside* the shaded face
   * and minutes on a band *outside* it, separated by the whole tick band and
   * the rim. `visual.test.ts` pins that constraint.
   *
   * Putting the minute band outside the face has a second payoff: out there the
   * backdrop is the page rather than the day/night gradient, so those numerals
   * take one quiet colour per theme instead of having to fight the shading.
   */
  hourLabels: {
    /**
     * Every second hour carries a numeral. Every third was what the 2013 page
     * used; two is close enough to read an hour off the dial without counting
     * ticks, and 12 numerals at this radius are nowhere near crowded.
     */
    step: 2,
    radius: 64,
    size: 9,
    weight: 500,
    /**
     * Two tones that trade places at `flipAt`: whichever one contrasts with the
     * face becomes the fill, and the other is available to stroke *underneath*
     * it (`paint-order: stroke`) as a halo.
     *
     * **`outlineWidth` is 0, so no halo is painted today.** The mechanism is
     * kept wired up — `HourLabels` still strokes `ink.outline` at this width —
     * because a non-zero value is the one knob that fixes the flip if it ever
     * needs fixing, and it is a knob rather than a rewrite. A zero-width SVG
     * stroke paints nothing, so leaving it on costs a no-op attribute and no
     * conditional.
     *
     * What the halo was for: just either side of the flip the fill is a
     * mid-tone on a mid-tone — about 3.5:1, against 14:1 or better at the ends
     * of the ramp — and outlined, the glyph reads against its own halo instead
     * of against the dial. That dip used to sit in the middle of the
     * civil-twilight band, spread over hours of dial arc. Since the ramp was
     * narrowed to `FULL_DARK_DEG`…`FULL_LIGHT_DEG` the flip lands on the true
     * horizon and the mid-tones either side of it are minutes wide, not hours,
     * which is why 0 is a reasonable setting rather than an oversight.
     *
     * The flip keeps the glyph *solid*. A single fixed pair was tried and
     * cannot win at both ends: dark-on-light is flawless over daylight and
     * hollow over night, and swapping the two mirrors the fault exactly — a `0`
     * becomes a bright ring and `22` a tangle of outlines. Only the tone that
     * contrasts with the face can be the fill.
     *
     * Keep the pair far apart in lightness; a close pair turns the halo into
     * decoration and hands legibility back to the gradient. `flipAt` is a
     * position on the 0..1 lightness scale, kept separate from the ticks' own
     * threshold so the two can be tuned independently.
     */
    inkDark: 'hsl(220 12% 12%)',
    inkLight: 'hsl(220 12% 92%)',
    flipAt: 0.5,
    outlineWidth: 0,
  },

  minuteLabels: {
    /**
     * Minutes carrying a numeral: 00, 05, 10 … 55. Twelve of them still leave
     * ~49 units of arc each out at this radius, so the band is nowhere near
     * full, and every fifth minute is the granularity people actually read a
     * clock face at.
     */
    step: 5,
    /**
     * Nudged out from 93 to make room for `sunArc` between this band and the
     * rim. At 93 the arc had only 0.8 units of air on each side and the two
     * strokes merged into what read as a doubled silhouette rather than as two
     * marks. 94 leaves 1.4 either side, and 94 + `size` is still 99, inside the
     * viewBox with a unit to spare.
     */
    radius: 94,
    size: 5,
    weight: 300,
    /**
     * One of the dial colours that follows the theme, and legitimately so: this
     * band sits outside the face, on the page. Deliberately quiet enough to
     * stay subordinate to the hours — see `--minute-ink` in `styles.css`.
     */
    fill: 'var(--minute-ink)',
  },

  /**
   * The band outside the rim spanning sunrise to sunset — what replaced the
   * "Sunrise 05:31 · Sunset 20:45" line that used to sit under the dial. Opt-in
   * now rather than on by default: the face's own shading turns at those two
   * instants, so this restates them rather than being the only record of them.
   * See `loadShowSunArc` in `settings.ts` for the rest of that argument.
   *
   * It lives in the corridor between the rim's painted outer edge (87.5) and the
   * minute numerals' inner edge (91.5) — the only free band that still reads as
   * part of the dial rather than as a detached ring. At width 0.2 it spans
   * 88.4…88.6, which leaves 0.9 units of air inside it and 2.9 outside, and
   * `visual.test.ts` pins it against both neighbours' *painted* edges rather than
   * their nominal radii.
   *
   * **That air is the whole reason `minuteLabels.radius` moved out to 94.** An
   * earlier attempt kept the band at 93, which left only 0.8 units either side:
   * at a 375px viewport that is ~1.4px, and on screen the arc and the rim merged
   * into a single doubled stroke that read as a rendering artefact rather than as
   * a mark. Widening the gap fixed it where retuning the colour could not.
   *
   * **A hairline, one fifth the rim's weight**, which is the opposite of where
   * this started: it was 1.2 units, *heavier* than the rim so as not to be
   * mistaken for one, and at that weight it read as a second silhouette anyway.
   * Going the other way works because weight was never the signal that separates
   * the two — the air between them is, and `--sun-arc` is a step brighter than
   * the ink around it. Keep it finer than the rim; the way back is more
   * separation, not more ink. Its ends are radial faces rather than round caps,
   * so each marks an exact minute; a round cap would smear each end by half the
   * width, which is the one thing this element exists to state precisely.
   *
   * Themed for the same reason `minuteLabels.fill` is: out here the backdrop is
   * the page, not the day/night gradient, so a fixed tone would fight one of the
   * two themes. That makes it the third and last entry in the allowlist
   * `visual.test.ts` pins.
   */
  sunArc: {
    radius: 88.5,
    width: 0.2,
    color: 'var(--sun-arc)',
  },

  /**
   * The reader's own times: up to five moments or intervals, tinting the face
   * itself rather than taking a ring of their own.
   *
   * **Why the band is 43…59 and not the whole face.** Everything the dial reads
   * *against* the shading stays outside it: the hour numerals start at 59.5
   * (`hourLabels.radius - size / 2`), and the ticks, the rim and both ink flips
   * live further out still. So no numeral, tick or rim ever has a tinted
   * backdrop, and every contrast ratio measured for them — here and beside
   * `--dial-outline` in `styles.css` — survives a marker being drawn under them,
   * which a full-face wedge would have invalidated at a stroke. The inner edge
   * is set by the readout below: 43 clears the corners of its text box.
   *
   * **Why a saturated hue rather than a tone.** A tint has to be visible over
   * both ends of a ramp that runs L96% to L5%, and no single lightness can be:
   * dark over daylight is light over night and vice versa. The face is a
   * *desaturated* scale, so an accent separates by hue instead, which works
   * identically at both ends. That is the whole argument for `palette.accentHue`.
   *
   * **Opacity carries emphasis, not colour.** One accent for all five markers —
   * they are told apart by where they sit and by the readout naming the next
   * one, not by a palette the reader has to learn. Past spans recede, upcoming
   * ones sit mid-way, the one in progress is loudest, and `remaining` — the
   * stretch from *now* to the end of an interval in progress — is louder still,
   * because a block visibly shrinking is the answer to "how much of this is
   * left".
   *
   * The thin marks need their own scale: a 1.2-unit dash at 0.1 opacity is
   * invisible where a 16-unit wedge at 0.1 is a wash, so `moment` repeats the
   * three phases at values of its own rather than borrowing `wedge`'s.
   */
  markers: {
    inner: 43,
    outer: 59,
    /**
     * Lightness 60% rather than the 50% that would be the hue's most saturated
     * point: the tint has to survive the *night* side of the ramp too, where a
     * mid-lightness accent at these opacities went nearly black. Raising it costs
     * almost nothing over daylight, because there the mark is carried by hue
     * rather than by contrast.
     */
    accent: 'hsl(38 90% 60%)',
    /**
     * `active` is only the *elapsed* part of a block in progress; `remaining` is
     * the rest of it, and the two are separate wedges rather than one under the
     * other — see `MarkerWedges`, which explains why stacking them would paint an
     * opacity neither of these numbers names.
     */
    wedge: { past: 0.13, upcoming: 0.26, active: 0.34, remaining: 0.62 },
    /** A moment has no arc to sweep, so it draws as a radial dash. */
    moment: { width: 1.2, past: 0.4, upcoming: 0.8, active: 1 },
    /**
     * The next boundary, drawn at full strength across the band. Same reasoning
     * as `sunArc`'s radial faces: the edge states the instant precisely, the
     * fill only states the shape of the day.
     */
    boundary: { width: 0.9 },
    /**
     * The countdown at the hub — two lines, centred, in the disc the wedge band
     * leaves free.
     *
     * Text on the face cannot lean on the shading the way the numerals do: the
     * ring's slices all converge at the centre, so a glyph here sits over a fan
     * of every lightness in the day at once and no fill can be chosen against
     * it. It is stroked with a halo underneath instead (`paint-order: stroke`),
     * so the glyph reads against its own outline and the backdrop stops
     * mattering — the mechanism `hourLabels.outlineWidth` documents and keeps at
     * 0 precisely so it is available when something needs it. This needs it.
     *
     * `halfWidth`/`top`/`bottom` are the box the text must stay inside, and they
     * are what sets `inner` above: the box's bottom corners reach
     * `√(28² + 32²) ≈ 42.5`, so the band starts at 43. `visual.test.ts` pins
     * that. The character cap that keeps the *label* inside the same box is
     * `MAX_LABEL_LENGTH` in `markers.ts` — no test can measure SVG text.
     */
    readout: {
      halfWidth: 28,
      top: 10,
      bottom: 32,
      halo: 'hsl(220 14% 10%)',
      haloWidth: 1.4,
      label: { y: 19, size: 6, weight: 500 },
      detail: { y: 29.5, size: 9.5, weight: 600 },
    },
  },

  hands: {
    core: 'hsl(220 14% 10%)',
    halo: 'hsl(220 12% 96% / 0.55)',
    /**
     * How far the halo stroke bleeds past the core it backs. The halo is what
     * keeps a near-black hand visible where it crosses the night sector.
     */
    haloBleed: 1,
    /**
     * Counterweight length behind the centre. Equal to `hub.radius` today, but
     * its own value on purpose: sharing one would mean enlarging the hub also
     * lengthened both tails, which is not what "make the hub bigger" means.
     *
     * Note the tail's round cap paints ~2 units beyond the hub disc, so a stub
     * shows opposite each hand. That is the existing look — the favicon draws
     * it too — not an oversight.
     */
    tail: 6,
    /** Shorter than the minute hand and stopping short of the numerals it
     *  points at, as on any 24-hour dial. */
    hour: { length: 55, width: 3.4 },
    /**
     * Stops just inside where the quarter-day ticks end rather than running out
     * to the face: the outer band is read off the hand's angle, not off its tip
     * touching anything, so the extra length only crowded the tick band.
     */
    minute: { length: 70, width: 1.4 },
    hub: { radius: 6, haloWidth: 1 },
  },
} as const;
