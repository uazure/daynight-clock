# AGENTS.md

Orientation for anyone — human or agent — picking this repository up. This file is the whole
of it; the user-facing description is [README.md](README.md). Deeper reasoning lives in doc
comments next to the code it explains, not in separate documents — see "Where the reasoning
lives" below.

## What this is

A 24-hour analog clock. One turn of the hour hand is one day, noon at the top and midnight
at the bottom, and the dial face is shaded by the sun's real altitude at the selected
place — daylight above +6°, night below -6°, an eased transition between. Both the shading
and the hands run on that place's own IANA time zone, so picking Tokyo from Prague shows
Tokyo's clock. The reader can also shade up to five times of their own onto the face — a
wake-up, the hours of work — with a countdown at the hub to whichever boundary comes next.

Non-goals: no server, no accounts, no analytics, no network calls at runtime, no precise
location. Coordinates never leave the device (rounded to ~1 km) and nothing is persisted
beyond six `localStorage` keys — the chosen place, the theme, whether the year knob is on,
whether the digital clock is on, whether times are written on a 12-hour clock, and the
reader's own times. The date that knob *selects* is deliberately **not** among them.

## Target platforms

Modern evergreen browsers, desktop and mobile, as a static site. `dist/` uses relative
paths only, so it runs from any static host, any subdirectory, or `file://`. It is a PWA and
works fully offline once loaded, city search included. Node 22 for tooling (matches CI);
the build itself has no OS dependencies, though development here happens on Windows.

## Stack and core decisions

- **Vite 8 + React 19 + TypeScript 7**, strict. Dial rendered as **SVG**, not canvas — the
  original 2013 version was canvas + jQuery and none of it remains. TypeScript 7 is the native
  Go port, which is also why the linter is Biome — see the note under Commands.
- **Biome is the linter and the formatter**, one tool for both. No ESLint, no Prettier.
- **Sample altitude, don't solve for events.** The face is shaded by sampling the sun's
  altitude once per minute of the day (1440 samples, [suncalc](https://github.com/mourner/suncalc))
  and mapping each to a lightness, instead of computing sunrise/sunset and filling wedges.
  Polar day and polar night then need no special case anywhere.
- **The shading window is +6°…-6°, tuned for a city, not for the twilight bands.** Below
  about -6° a city street is lit by streetlights and stops getting darker, so the nautical
  and astronomical bands carry no information here. The full argument, with the numbers the
  old twilight-anchored ramp got wrong, is above `FULL_DARK_DEG` in `src/lib/lightness.ts`.
- **Zone arithmetic through `Intl` only**, all of it in `src/lib/time.ts`. No date library.
- **Pure `src/lib/`, thin React.** Logic lives in framework-free modules with tests;
  components are renderers over them.
- **Location is a resolver chain**, most-trusted first: a manually chosen city, a coarse
  geolocation fix, a guess from the device zone, a rougher guess from the UTC offset,
  then `0,0`. Each tier is labelled honestly in the UI.
- **The build stamps itself.** `vite.config.ts` `define`s the package version, the commit
  (`GITHUB_SHA`, else `git rev-parse`, else empty) and an ISO build date; `src/lib/build.ts`
  reads them back and *What is this?* shows the line. A build with no git behind it says so
  rather than linking to a 404. The service worker is `autoUpdate`, so the version a reader
  sees is the bundle actually running — which is what makes it worth quoting in a bug report.
  **The patch number is the pull request that shipped it**, not a semver count: 0.0.10 came
  from PR #10. Bump it in the PR itself, so the version a reader quotes leads straight to the
  change and its discussion.
- **City data is generated and committed**, not fetched: `cities.json` (3,058 cities) is
  code-split behind a dynamic `import()`; `timezone-coords.json` (356 zones) is bundled
  because the resolver needs it on the first frame.

## Layout

```
src/lib/         pure logic + colocated *.test.ts (time, sun, lightness, visual, dial,
                 geometry, year, location, cities, theme, settings, markers, build)
src/hooks/       useNow, useDayProfile, useLocation, useTheme, useMarkers,
                 useFullscreen, useYearKnob, useYearDrag, useNarrowViewport,
                 useShowDigitalTime, useHour12
src/components/  Clock + dial parts (incl. YearKnob, MarkerWedges, MarkerReadout,
                 DigitalReadout), YearSlider, LocationPanel, ModalSheet and its five
                 sheets (MainMenu, SettingsModal, CityPickerModal, MarkersModal,
                 AboutModal)
src/data/        generated JSON — do not hand-edit; see src/data/README.md
scripts/         build-cities.mjs, run by hand, never part of the build
```

## Commands

```bash
npm install
npm run dev         # http://localhost:5173
npm test            # vitest run — 320 tests, ~3s
npm run typecheck   # tsc -b
npm run lint        # biome check — lint, format and import order, read-only
npm run lint:fix    # biome check --write — applies all three
npm run build       # tsc -b && vite build → dist/
npm run preview     # serve dist/
```

CI (`.github/workflows/deploy.yml`) runs lint → typecheck → test → build → deploy to
Cloudflare Pages on every push to `main`, and on manual dispatch from any branch. Manual runs
go to a preview URL unless the `production` input is ticked. The workflow cannot create its own
infrastructure: it needs a `daynight-clock` Pages project, the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets, and any custom domain attached by hand.

### Biome, and why not ESLint

`biome.json` configures one tool as formatter, linter and import organiser. The enforced style is
semicolons, single quotes, 2-space indent, 120-column lines, and imports grouped
external → parent-relative → sibling-relative with side-effect style imports last (which is what
keeps `import './styles.css'` at the bottom of `main.tsx`).

**ESLint is not an option here, and it is worth knowing why before trying.** TypeScript 7 is the
native Go port: its npm package ships platform binaries and the classic JS compiler API is gone —
`ts.createSourceFile`, `ts.createProgram` and `ts.SyntaxKind` are all `undefined`.
`@typescript-eslint/typescript-estree` calls exactly those, and typescript-eslint's peer range is
`typescript >=4.8.4 <6.1.0`, with no tsgo-compatible release. ESLint therefore cannot parse a
single file in this repo. Biome parses TypeScript itself in Rust and never loads the `typescript`
package, so it is unaffected. Adding ESLint would mean downgrading TypeScript first.

Two consequences of that trade: there are **no type-aware lint rules** (Biome does not do them),
so `tsc` remains the only checker that reasons about types; and CSS, HTML, Markdown and YAML are
outside Biome's scope here — CSS and HTML formatting are off by default and Markdown/YAML support
is still unfinished upstream, which is why `styles.css`, `index.html` and this file keep their
hand-written formatting.

Biome's autofixes are not all safe to take on trust. `lint:fix` applies only the safe ones;
`--unsafe` has twice rewritten deliberate code into something worse here — turning a mount-only
effect's `[]` into a dependency array that steals focus mid-interaction, and turning a `!`
assertion into `?.`, which typechecks as `undefined`. Read what it changed.

## Working agreements

**Agents do not commit, and do not stage.** Leave finished work in the working tree and say what
changed; the commit, its message, and its granularity are the maintainer's. This holds even when the
work is verified and green — "typecheck and tests pass" is a reason to hand it over, not to commit
it. `git add`, `git commit`, `git push`, `git rebase` and friends are off limits unless asked for by
name in that session. Read-only git (`status`, `diff`, `log`, `show`) is always fine.

## Rules

Each of these cost a bug to find. Every one is also documented at its call site, with the
failure it prevents — the notes here are the index, the code holds the reasoning.

1. **Sample `i` is wall-clock minute `i` of the day in the target zone.** `sampleDay`
   resolves every sample instant from zone wall-clock components; `sampleIndexForHour`
   reads it back the same way. Index by elapsed milliseconds instead and the whole ring
   rotates an hour away from the hands on DST transition days.
2. **One zone decides everything on screen.** `App` computes it once and threads it down.
   Downstream code must not reach for the device zone or a bare `Date#getHours` — a +5:45
   zone moves even the minute hand. The 12-hour preference works the same way — passed down,
   never read from storage mid-tree — and it reaches every time the app *writes*. It
   deliberately stops at `formatMinutesOfDay`, which feeds `<input type="time">` values in
   the markers editor: the HTML spec fixes that format at 24-hour and the browser localises
   the control itself.
3. **Nothing in `src/lib/` imports React or touches the DOM**, except `location.ts`
   (`navigator`, `localStorage`), `theme.ts` and `settings.ts` (`localStorage`). Every
   storage call is wrapped in `try`/`catch`: Safari private browsing throws on `setItem`,
   and that must degrade to an in-memory session rather than break a control. `settings.ts`
   validates nothing itself — the shape of a stored marker is `markers.ts`' business, which
   is what keeps that module pure and testable.
4. **Never request geolocation without an explicit user action, and never without the
   accuracy-and-privacy note visible beside the control that triggers it.** One
   `getCurrentPosition` call site, coarse options only. A stored manual city outranks GPS.
   Two things this rule used to name are gone, both for covering the dial to talk about it:
   a blocking consent modal, then the `LocationHint` note that floated over the lower rim.
   The first run now asks nothing at all — the panel states which tier answered — and the
   note travelled with the button to `CityPickerModal`, which holds the only control in the
   app that can trigger a fix. Move that button and the note moves with it.
5. **The theme switches page chrome, never the dial.** Night stays dark and day stays
   bright in both themes. Every dial visual — color, size, radius, stroke width — is
   decided in `src/lib/visual.ts` and nowhere else; a literal `hsl()` there is
   theme-independent, and the only three `var(--…)` exceptions paint on or outside the face's
   edge, where the backdrop really is the page — the rim, the year knob, the minute band.
   `visual.test.ts` pins that split by exact equality, so a fourth has to be argued for.
   **The face is also one hue, `palette.hue`, with no exceptions.** The reader's markers
   used to be the pinned exception, on an accent hue, because no single tone reads over
   both ends of the lightness ramp. They now carry both tones instead — a `markers.core`
   fill under a `markers.halo` edge, the hands' recipe — so the dark half of the pair
   reads over daylight and the light half over night. Pinned the same way, by exact hue.
   Text at the hub is the third case of the same recipe: near the centre the ring's slices
   have converged, so a block spans hours of the day at once and every glyph is stroked with
   the opposite tone under its own fill. `VISUAL.hubText` holds that pair. Whether the pair
   also **flips** with the shading is per block, deliberately: `markers.readout` flips,
   because at 5 units a light fill on a near-white face reads as a hollow outline — which is
   what the countdown did through a polar day — while `VISUAL.digital` pins the orientation
   light-over-dark, since it sits over the midnight fan and 12-unit type outlined in black
   still reads as type. `meanLightnessAround` computes the mean the flip is decided against.
6. **Keep `cities.json` behind a dynamic `import()`.** A static import puts ~155 KB into
   the initial bundle.
7. **Don't hand-edit `src/data/*.json`** and don't wire `scripts/build-cities.mjs` into
   the build. `public/*.png` are generated the same way — from `public/favicon.svg` via
   `pwa-assets.config.js` — and are likewise committed rather than built.
8. **The manifest needs raster icons, not just the SVG.** Chrome will not offer to install
   the app without a 192x192 and a 512x512 PNG; an SVG at `sizes: "any"` does not satisfy
   its check, and declaring only the SVG is why installing was impossible on Android for a
   while. iOS needs the separate `apple-touch-icon` link in `index.html` or it uses a
   screenshot of the page as the icon.
9. **`ModalSheet`'s focus trap takes the first and last *tab stop*, and its selector matches
   more than that.** Unchecked radios in a group, `disabled` controls and CSS-hidden controls
   all match `FOCUSABLE_SELECTOR` without being tab stops, and then `focusable[0]` and the
   last entry are not the real ends: Shift-Tab from a checked radio that was not the first
   match escaped the sheet into the browser chrome. That is why the theme control is a
   `<select>` — one tab stop, one match — and not the radio group it briefly was. If any of
   the three ever appear, collapse the list to real tab stops first.
10. **Sheets replace each other, so focus restoration needs an explicit anchor.** Each sheet
   captures what was focused when it opened, but in a chain (burger → settings → picker) that
   capture is a control inside the sheet it replaced, detached by the time the chain ends —
   and focusing a detached node silently does nothing, so closing left focus on `<body>`.
   `App` holds `overlayOrigin` and passes it as `restoreFocusRef`; only the *entry points* set
   it, and the ones that open a single sheet clear it so a stale burger reference cannot steal
   focus from the link the reader actually used.
11. **One `Overlay` value in `App`, never a boolean per dialog.** `null | 'menu' | 'settings'
   | 'picker'`, so "menu and settings both open" is unrepresentable and the handoffs are
   replaces rather than nests — two stacked scrims double-dim the page and stack two focus
   traps. `.app-content` is `inert` whenever one is up, which is also what stops the burger
   being re-triggered from behind a scrim. `.scrim` needs a `z-index` above `.burger`, or the
   fixed burger paints straight through the anchored menu sheet. Closing undoes *one*
   opening, not the chain: `pickerReturnsTo` remembers whether the settings sheet opened the
   picker and sends it back there, and the settings sheet reads the same value to know it is
   being re-shown and to put focus back on *Change location…*. It is a return target, not a
   second open overlay — one `Overlay` value still decides what is on screen.
12. **The dial is sized from whatever height `.panel` leaves**, so nothing in the panel may
   change height after mount. That is why every chooser lives in an overlay, and why the
   panel's source line is unconditional — it used to be suppressed while a floating hint was
   up, which made it a line that could arrive a tick after mount. The portrait lift is a `transform` on `.clock` for the same
   reason: moving the dial into an `auto` grid row makes its `height: 100%` indefinite and it
   loses its size entirely. The `max-aspect-ratio` guard on that rule is load-bearing — the
   lift only has letterbox space to spend on a screen much taller than it is wide.
13. **`suncalc`'s `getPosition().altitude` is *apparent* altitude — refraction is already
   in it.** So the sunrise threshold is `HORIZON_DEG = -0.349°`, not the geometric -0.833°
   every table quotes. Using -0.833° subtracts refraction twice and fired the crossing a
   flat 3 min early at mid latitudes, 4.4 min at Reykjavík, every day of the year. It
   survived because `sun.test.ts` allowed 10 minutes against suncalc's own `getTimes` and
   blamed the gap on "different solar models" — there is no second model, both sides come
   from `getPosition`. The tolerances are 1 min and 0.1 min now; don't loosen them.
14. **Nothing the markers draw may reach past `markers.maxOuter` (59).** Everything the dial
   is read *against* — the hour numerals, the ticks, the rim, both ink flips — lives outside
   that radius, so a tinted wedge can never become part of a backdrop one of those contrast
   ratios was measured against. Widen the band past the numerals' glyph edge and every ratio
   in `styles.css` and in `visual.ts` silently becomes a claim about an untinted face.
   The bound is `maxOuter` rather than `outer` because overlapping markers stack outward in
   lanes: `outer` is one lane's height, and `laneBand` shrinks that height so the outermost
   lane lands on `maxOuter` exactly however many lanes there are. `markers.test.ts` pins the
   landing — that `laneBand` never returns a radius past the bound, whatever the bound is set
   to. The *value* of `maxOuter` against the numerals' glyph edge is not pinned anywhere:
   it is a layout judgement, and the note at the top of `visual.test.ts` explains why that
   file no longer asserts where anything sits. Inside `maxOuter` sits the readout box, whose
   corners are what `markers.inner` is chosen around.
15. **Two translucent wedges of the same marker phase must never overlap.** They would
   composite to an opacity nothing in `visual.ts` names, and the reader would try to read
   meaning into the third shade. Three things hold that line: `MarkerWedges` emits **one path
   per phase** with every span as a subpath, so a fill happens once however many markers
   cross; it *splits* the block in progress at `now` rather than laying `remaining` over
   `active`; and `markerLanes` gives markers that share minutes **different radii**, so they
   cannot overlap at all. Adding a phase means adding a path, not a `<g opacity>`.
   Note the lane rule is also what makes a contained interval *visible* — a 30-minute break
   inside a work block was previously indistinguishable from the work, precisely because the
   fill happens once. Longest interval innermost, shorter ones stacking outward, is the order
   a reader expects. Moments are exempt: they draw across every lane, which is what makes an
   instant readable against the intervals it falls inside.
16. **The simulated date may reach the dial as shading and as nothing else.** The year knob
   is opt-in and off by default, and switching it off returns the dial to today — `App` reads
   that through one derived `activeDay` rather than resetting in the settings handler, so the
   invariant holds however the setting changes. It selects a day; `App` turns it into a
   `dateKey`, and `useDayProfile` turns that into a profile. `Clock` then receives it by exactly three routes — the `profile` it shades with,
   the `dayOfYear` the knob is drawn at, and a string in the `aria-label`. **Nothing
   time-of-day is derived from it**: `minuteOfDay`, `nextBoundary`, `MarkerWedges`,
   `MarkerReadout` and `Hands` all come off the real `now`, so the hands keep the real time
   and the countdown stays a real measurement. This holds structurally rather than by care,
   because no simulated `Date` exists anywhere in the tree to reach for by accident — keep it
   that way. Do not persist the simulated day either: reopening the app days later to a
   simulated date, with no memory of having set one, is worse than losing a scrub position.
17. **`sampleDay`'s offsets come from one `OffsetTimeline` per day, and `time.test.ts` proves
   that is the same function as asking `Intl` per sample.** The timeline cut a profile from
   ~15 ms to ~1.3 ms, which is what makes scrubbing possible at all — 90% of the old cost was
   2880 `formatToParts` calls, not suncalc. It is safe *only* because it changes where the
   offset numbers come from and not how a sample instant is derived, and because an
   equivalence sweep asserts the fast and slow paths agree to the millisecond for every
   minute of every day across zones with half-hour DST, quarter-hour offsets and a midnight
   transition. `instantForZoneWallClock` stays exported and untouched as the reference. **Keep
   that sweep**: it is the only thing standing between this optimisation and the class of bug
   commit 172c4d1 fixed.
18. **A focusable control may not live inside the `role="img"` dial.** `role="img"` makes its
   subtree presentational, so the year knob's real control is a visually-hidden native
   `<input type="range">` outside the SVG (`YearSlider`), and the knob's graphics stay
   decorative. A native range brings the slider role, arrow stepping and — the part that
   matters — automatic value announcement, so there is no live region to double-announce.
   `aria-valuetext` carries the date, or it announces "216". Focus it on `pointerup` and
   never on `pointerdown`: a focused slider announces every one of a drag's hundreds of
   values.
19. **A sheet is three rows — header, one scrolling body, actions — and only the body may
   scroll.** `ModalSheet` renders all three, including the heading and the close control, so
   a caller cannot put chrome inside the scrolled region: when `.sheet` was itself the
   scroller, the settings sheet on a phone pushed *Close* below the fold and it could only be
   reached by scrolling down to it. The mobile `margin-top: auto` meant to pin it collapses
   the moment content overflows, which is the one case it existed for. `overflow: hidden` on
   `.sheet` plus `min-height: 0` on `.sheet-body` is what holds it; the safe-area insets are
   applied per row, because the two rows that must stay put are the two against the notch and
   the home indicator.
20. **One close control exists at a time, and JS decides which.** *Close* on the action row
   below 40rem, an X in the header above it — chosen by `useNarrowViewport`, never by hiding
   one in CSS. A `display: none` control still matches `FOCUSABLE_SELECTOR` without being a
   tab stop, which is rule 9's bug wearing a different hat. The breakpoint is duplicated in
   that hook and in styles.css and the two must agree. The anchored menu has no close control
   at all: it is a popover, dismissed by choosing from it.
21. **Focus lands on the sheet itself, not on its first control.** `ModalSheet` gives the
   dialog `tabindex="-1"` and focuses it, so a screen reader announces the dialog and its
   title; `initialFocusRef` is for the cases where a specific control *is* the reason the
   sheet opened (the picker's search field, the menu's first item, the button a child sheet
   returns to). "First focusable" was the old default and it is a moving target — it became
   the X when the close control arrived, and the commit link when the build stamp was added
   to *What is this?*.

## Testing conventions

Vitest with `environment: 'node'`, `src/**/*.test.ts` only. **Pure logic** — no jsdom, no
React Testing Library, so component and hook tests are deliberately out of scope. Where a
browser global is unavoidable, stub it (`localStorage` in `theme.test.ts`,
`Intl.DateTimeFormat` in `location.test.ts`). Where a zone-dependent failure would be
*invisible* from Prague, design it out instead of guarding it — see `formatDayOfYear`, which
builds a local midnight rather than a UTC one for exactly that reason.

`vite.config.ts` pins `TZ=Europe/Prague` so the suite is machine-independent. Name a zone
explicitly in new fixtures; only use `new Date(y, m, d, …)` when that zone is Prague.
Compute expected solar altitudes by running suncalc, never by arithmetic.

The suite's most valuable test composes `sampleDay` with `sampleIndexForHour` across DST
transition days in two zones — that seam being untested is how the ring-rotation bug
survived nine reviews. Prefer tests that cross a module boundary; all three bugs found by
the final whole-branch review sat between modules that were individually correct.

**Do not test taste, and do not test position.** `visual.test.ts` once pinned the dial's
whole geometry — box corners inside the wedge band, glyph caps clearing the hub, hands
stopping short of the numerals — plus every visual ranking, from the wedge opacities to
which type was largest. All of it was a previous opinion frozen into an assertion, and it
cost most when the layout was being *designed* rather than kept: moving one line four units
failed two tests that described no defect. Those pins are gone. A layout is judged by
looking at the rendered dial, which node cannot do; the constants carry their ranges and
their reasoning in `visual.ts` doc comments instead. What that file still asserts is only
what looking would *not* reveal — the theme and hue rules, the ink pairs bracketing the
lightness ramp, where the flips land on the sun's own ramp, and arithmetic that would break
the render rather than merely look wrong. Its header argues the line in full.

## Where the reasoning lives

In doc comments, next to the constant or the branch they explain. This repo has no design
docs, no handoff document and no `docs/` tree — process artifacts went stale faster than they
were read, and `docs/` is gitignored so scratch work stays out of the history. Two
consequences worth knowing:

- **A constant without a comment explaining why *that* number is incomplete.** The measured
  contrast ratios in `styles.css`, the tick-tier rationale in `visual.ts`, the invariant block
  above `sampleDay` — that is the documentation, and it is expected to be updated alongside
  the value.
- **`git log` is the historical record.** Superseded specs and plans were removed from the
  working tree, not from history; recover one with `git show <rev>:docs/…` if the reasoning
  behind an old decision is ever needed.

## Current state

`main` holds the rewrite (merged in PR #1) plus the day/night favicon and the
hours-and-minutes dial. The 2013 canvas/jQuery version survives only in history. GitHub Pages
should be set to "None" as its source so the old copy stops serving.
