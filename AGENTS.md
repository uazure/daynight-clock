# AGENTS.md

Orientation for anyone — human or agent — picking this repository up. Deeper detail lives
in [docs/HANDOFF.md](docs/HANDOFF.md); the user-facing description is [README.md](README.md).

## What this is

A 24-hour analog clock. One turn of the hour hand is one day, noon at the top and midnight
at the bottom, and the dial face is shaded by the sun's real altitude at the selected
place — daylight, the three twilight bands, night. Both the shading and the hands run on
that place's own IANA time zone, so picking Tokyo from Prague shows Tokyo's clock.

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
  original 2013 version was canvas + jQuery and none of it remains.
- **Sample altitude, don't solve for events.** The face is shaded by sampling the sun's
  altitude once per minute of the day (1440 samples, [suncalc](https://github.com/mourner/suncalc))
  and mapping each to a lightness, instead of computing sunrise/sunset and filling wedges.
  Polar day and polar night then need no special case anywhere.
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
src/lib/         pure logic + colocated *.test.ts (time, sun, lightness, dial, geometry,
                 location, cities, theme)
src/hooks/       useNow, useDayProfile, useLocation, useTheme
src/components/  Clock + dial parts, LocationPanel, ThemeToggle, ModalSheet and its two
                 dialogs (GeolocationPrompt, CityPickerModal)
src/data/        generated JSON — do not hand-edit; see src/data/README.md
scripts/         build-cities.mjs, run by hand, never part of the build
docs/            HANDOFF.md plus the design spec and implementation plan under superpowers/
```

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest run — 129 tests, ~1.5s
npm run typecheck  # tsc -b
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve dist/
```

CI (`.github/workflows/deploy.yml`) runs typecheck → test → build → deploy to Cloudflare
Pages on every push to `master`, and on manual dispatch from any branch. Manual runs go to
a preview URL unless the `production` input is ticked. Design and required Cloudflare setup:
[docs/superpowers/specs/2026-07-31-cloudflare-pages-deploy-design.md](docs/superpowers/specs/2026-07-31-cloudflare-pages-deploy-design.md).
There is no linter or formatter configured; match surrounding style.

## Rules

Full list with the reasoning in [docs/HANDOFF.md](docs/HANDOFF.md) under "Invariants" —
each one cost a bug to find. The load-bearing ones:

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
4. **Never request geolocation before the user has acted on the explanation modal.** One
   `getCurrentPosition` call site, coarse options only. A stored manual city outranks GPS.
5. **The theme switches page chrome, never the dial.** Night stays dark and day stays
   bright in both themes; dial colour is decided in `lightness.ts`.
6. **Keep `cities.json` behind a dynamic `import()`.** A static import puts ~155 KB into
   the initial bundle.
7. **Don't hand-edit `src/data/*.json`** and don't wire `scripts/build-cities.mjs` into
   the build.

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

## Current state

Branch `rewrite/vite-ts` holds the complete rewrite and is pushed to `origin`. It has
**not** been merged — `master` still holds the 2013 code, and a fast-forward is all that's
needed. Deployment goes to Cloudflare Pages, which needs a `daynight-clock` Pages project,
the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets, and the custom
domain attached by hand — none of which the workflow can create. GitHub Pages should be set
to "None" as its source so the old copy stops serving. See
[docs/HANDOFF.md](docs/HANDOFF.md) for what remains.
