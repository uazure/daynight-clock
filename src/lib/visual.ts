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
 *   rim, all of them measured against the ramp rather than guessed).
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
   * against 96% at the bright end and ~10.5% at the dark end (the lowest the
   * ramp actually reaches, `LIGHTNESS_ANCHORS[0]` being 0.06 rather than 0).
   */
  palette: { hue: 220, saturation: 12, band: { min: 5, max: 96 } },

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
     * face becomes the fill, and the other is stroked *underneath* it
     * (`paint-order: stroke`) as a halo. Both halves earn their keep.
     *
     * The halo rescues the flip. Just either side of it the fill is a mid-tone
     * on a mid-tone — about 3.5:1, against 14:1 or better at the ends of the
     * ramp — and that dip sits in the civil-twilight band, exactly where a
     * reader looks to find dawn and dusk. Outlined, the glyph reads against its
     * own halo instead of against the dial.
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
    radius: 93,
    size: 5,
    weight: 300,
    /**
     * The one dial colour that follows the theme, and legitimately so: this
     * band sits outside the face, on the page. Deliberately quiet enough to
     * stay subordinate to the hours — see `--minute-ink` in `styles.css`.
     */
    fill: 'var(--minute-ink)',
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
