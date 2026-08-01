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
Tokyo's clock.

Non-goals: no server, no accounts, no analytics, no network calls at runtime, no precise
location. Coordinates never leave the device (rounded to ~1 km) and nothing is persisted
beyond two `localStorage` keys.

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
- **City data is generated and committed**, not fetched: `cities.json` (3,058 cities) is
  code-split behind a dynamic `import()`; `timezone-coords.json` (356 zones) is bundled
  because the resolver needs it on the first frame.

## Layout

```
src/lib/         pure logic + colocated *.test.ts (time, sun, lightness, visual, dial,
                 geometry, location, cities, theme)
src/hooks/       useNow, useDayProfile, useLocation, useTheme
src/components/  Clock + dial parts, LocationPanel, LocationHint, ThemeToggle, ModalSheet
                 and its one dialog (CityPickerModal)
src/data/        generated JSON — do not hand-edit; see src/data/README.md
scripts/         build-cities.mjs, run by hand, never part of the build
```

## Commands

```bash
npm install
npm run dev         # http://localhost:5173
npm test            # vitest run — 153 tests, ~1.5s
npm run typecheck   # tsc -b
npm run lint        # biome check — lint, format and import order, read-only
npm run lint:fix    # biome check --write — applies all three
npm run build       # tsc -b && vite build → dist/
npm run preview     # serve dist/
```

CI (`.github/workflows/deploy.yml`) runs lint → typecheck → test → build → deploy to
Cloudflare Pages on every push to `master`, and on manual dispatch from any branch. Manual runs
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
   zone moves even the minute hand.
3. **Nothing in `src/lib/` imports React or touches the DOM**, except `location.ts`
   (`navigator`, `localStorage`) and `theme.ts` (`localStorage`). Every storage call is
   wrapped in `try`/`catch`: Safari private browsing throws on `setItem`, and that must
   degrade to an in-memory session rather than break a control.
4. **Never request geolocation without an explicit user action, and never without the
   accuracy-and-privacy note visible beside the control that triggers it.** One
   `getCurrentPosition` call site, coarse options only. A stored manual city outranks GPS.
   The blocking consent modal this rule used to name is gone — it covered the dial before
   the clock had shown anything, so the first run argued for a permission the reader had no
   reason to care about yet. `LocationHint` carries the note now, beside its own button.
5. **The theme switches page chrome, never the dial.** Night stays dark and day stays
   bright in both themes. Every dial visual — color, size, radius, stroke width — is
   decided in `src/lib/visual.ts` and nowhere else; a literal `hsl()` there is
   theme-independent, and the only two `var(--…)` exceptions paint on or outside the face's
   edge, where the backdrop really is the page. `visual.test.ts` pins that split.
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
9. **`suncalc`'s `getPosition().altitude` is *apparent* altitude — refraction is already
   in it.** So the sunrise threshold is `HORIZON_DEG = -0.349°`, not the geometric -0.833°
   every table quotes. Using -0.833° subtracts refraction twice and fired the crossing a
   flat 3 min early at mid latitudes, 4.4 min at Reykjavík, every day of the year. It
   survived because `sun.test.ts` allowed 10 minutes against suncalc's own `getTimes` and
   blamed the gap on "different solar models" — there is no second model, both sides come
   from `getPosition`. The tolerances are 1 min and 0.1 min now; don't loosen them.

## Testing conventions

Vitest with `environment: 'node'`, `src/**/*.test.ts` only. **Pure logic** — no jsdom, no
React Testing Library, so component and hook tests are deliberately out of scope. Where a
browser global is unavoidable, stub it (`localStorage` in `theme.test.ts`,
`Intl.DateTimeFormat` in `location.test.ts`).

`vite.config.ts` pins `TZ=Europe/Prague` so the suite is machine-independent. Name a zone
explicitly in new fixtures; only use `new Date(y, m, d, …)` when that zone is Prague.
Compute expected solar altitudes by running suncalc, never by arithmetic.

The suite's most valuable test composes `sampleDay` with `sampleIndexForHour` across DST
transition days in two zones — that seam being untested is how the ring-rotation bug
survived nine reviews. Prefer tests that cross a module boundary; all three bugs found by
the final whole-branch review sat between modules that were individually correct.

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

`master` holds the rewrite (merged in PR #1) plus the day/night favicon and the
hours-and-minutes dial. The 2013 canvas/jQuery version survives only in history. GitHub Pages
should be set to "None" as its source so the old copy stops serving.
