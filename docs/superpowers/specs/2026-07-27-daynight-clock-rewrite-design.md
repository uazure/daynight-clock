# daynight-clock rewrite — design

Date: 2026-07-27
Status: approved

## Purpose

A 24-hour analog clock whose dial background shows the day's light: full daylight,
the twilight transitions on either side, and true night. One full turn of the hour
hand is one full day. The clock needs the viewer's approximate position to know when
the sun rises and sets there; nothing more.

This replaces the 2013 canvas/jQuery implementation at the repo root. The original
idea, the 24-hour dial, and the polar-coordinate helper convention carry over; the
rendering, the sun math, and the location handling are rewritten.

## Stack

- Vite, React 19, TypeScript in `strict` mode
- `suncalc` 2.x for solar position — ships its own types (no `@types/suncalc`), ESM
  named exports, and reports angles in **degrees**
- Vitest for unit tests, logic only
- `vite-plugin-pwa` for offline capability
- `base: './'` so `dist/` runs from any subpath or from `file://`
- GitHub Actions: typecheck → test → build → deploy `dist/` to Pages on `master`

The old files (`daynight-clock.js`, `sunrise-sunset.js`, `index.html`,
`jquery-1.8.3.min.js`, `no-coords.png`) are deleted from the working tree. Git history
keeps them.

## Layout

```
index.html            vite.config.ts   tsconfig.json   tsconfig.node.json
scripts/build-cities.mjs
.github/workflows/deploy.yml
src/
  main.tsx  App.tsx  styles.css
  lib/
    geometry.ts     angle mapping, polar↔cartesian, sector paths
    sun.ts          suncalc wrapper, day sampling
    lightness.ts    altitude → luminance ramp
    location.ts     resolver chain, coarse geolocation, persistence
    cities.ts       lazy city dataset load + search
  data/
    timezone-coords.json    generated, bundled
    cities.json             generated, dynamically imported
  hooks/
    useNow.ts  useLocation.ts  useDayProfile.ts
  components/
    Clock.tsx  DayNightRing.tsx  Ticks.tsx  HourLabels.tsx  Hands.tsx
    LocationPanel.tsx  GeolocationPrompt.tsx
```

Everything in `lib/` is pure and independently testable. The React layer renders; it
does not calculate.

## Rendering the day/night ring

The original computed sunrise and sunset boundaries and filled wedges between them.
That approach needs a special case for every polar situation — the 1990 algorithm it
used returned error *strings* when the sun never rose or never set.

Instead, sample the sun's altitude across the local day:

```ts
// lib/sun.ts
sampleDay(dateKey, lat, lon): Float64Array
// 240 samples, one per 6 minutes of local time, each SunCalc.getPosition(t).altitude
```

```ts
// lib/lightness.ts — the only place brightness is decided
altitudeToLightness(altitudeDegrees): number  // 0..1
//   +6°     → 1.00   full day
//   -0.833° → 0.88   sunrise / sunset (refraction-corrected horizon)
//   -6°     → 0.58   civil twilight ends
//  -12°     → 0.32   nautical twilight ends
//  -18°     → 0.14   astronomical twilight ends
//  -30°     → 0.06   deep night floor
// piecewise-linear between anchors, clamped outside the range
```

`DayNightRing` emits one annular sector per sample, filled from a single-hue
luminance scale. The ramp is smooth across the four twilight bands while the
thresholds stay visible as inflection points, so the ring reads as an infographic
rather than a photograph. Polar day and polar night need no special case: the ring
simply comes out uniformly light or uniformly dark.

Recomputed when the local date changes or the location changes; memoized on
`(dateKey, roundedLat, roundedLon)`.

## Geometry

`viewBox="-100 -100 200 200"`, centre at the origin.

```ts
angleForHour(h)      = (h - 12) * 15        // degrees, 0 = up, clockwise
toCartesian(r, deg)  = { x: r*sin(deg), y: -r*cos(deg) }
sectorPath(r0, r1, a0, a1)                  // annular wedge path data
```

Noon at the top, midnight at the bottom: the hand points up when the sun is up. The
`toCartesian` convention matches the original `toDecart`.

The dial is fixed and the hands move. Hour hand: one turn per 24 hours. Minute hand:
one turn per hour. No second hand. A single 10-second interval in `useNow` drives
both. Hour ticks every hour, emphasised every 3; labels every 3 hours — the settings
the old `index.html` actually passed in. The SVG scales to `min(100vw, 100vh)`.

## Location

Approximate position is sufficient and is all the app asks for.

### Resolver chain

`lib/location.ts` resolves in order, each result tagged with its source so the UI can
say where the number came from:

1. `localStorage` override → `{ lat, lon, label, source: 'manual' }`
2. coarse `navigator.geolocation` → `source: 'gps'`
3. `Intl.DateTimeFormat().resolvedOptions().timeZone` → `timezone-coords.json` →
   `source: 'timezone'`
4. `0, 0` with a visible warning → `source: 'fallback'`

Steps 1 and 3 are synchronous, so the first paint is already correct for the viewer's
region; a GPS result only sharpens it.

### Consent

Geolocation is never requested on load. `GeolocationPrompt` explains, before any
browser permission dialog appears, that the coordinates are used only to compute
sunrise and sunset and never leave the device, offering *Use my location* and
*Not now*.

- `navigator.permissions.query({ name: 'geolocation' })` is `granted` → request
  silently, no modal
- `prompt` → show the explanation modal
- `denied` → never request; the location panel explains how to set a place manually
- Permissions API unsupported → show the explanation modal

A *Not now* is persisted, so the modal does not reappear on later visits. The location
panel keeps a "use my location" button as the way back in.

### Coarse only

```ts
getCurrentPosition(ok, err, {
  enableHighAccuracy: false,
  maximumAge: 900_000,
  timeout: 8_000,
})
```

Returned coordinates are rounded to 2 decimal places (~1 km) before being used or
stored. At this scale that moves sunrise by a few seconds.

### City data

`scripts/build-cities.mjs` reads GeoNames `cities15000` (CC BY 4.0, attributed in the
README), filters to population ≥ 200,000, and emits both data files:

- `cities.json` — ~1,500 entries of `[name, country, lat, lon, tz]`, ~60 KB raw and
  ~15 KB gzipped, loaded by dynamic `import()` only when the location panel opens
- `timezone-coords.json` — the largest city per IANA zone, ~400 entries, bundled
  because the resolver needs it on the first frame

Both outputs are committed, so builds are offline and reproducible. The script exists
for regeneration, not as a build step.

IANA zone names drift (`Europe/Kiev` → `Europe/Kyiv`, `Asia/Calcutta` → `Asia/Kolkata`).
The lookup takes an exact hit first, then a small hand-written alias map, then falls
back to scanning the table for a zone whose current UTC offset matches the device's.

### Clock timezone

The dial always shows the **device's** local time. When a manually chosen city sits in
a different IANA zone, the location panel says so plainly ("Tokyo is UTC+9, your device
is UTC+3 — the dial shows your local time") rather than silently reinterpreting the
hands. Rendering a foreign timezone's wall clock is out of scope.

## Tests

Vitest, pure logic only. The React layer stays a thin renderer over tested functions,
so it gets no test suite.

- **geometry** — angle mapping at 0/6/12/18h; polar↔cartesian round-trip; sector path
  endpoints match `toCartesian` at both angles
- **sun** — altitude for fixture city/date/time against published values within 0.5°;
  Svalbard in June yields all-positive samples and in December all-negative
- **lightness** — monotonic in altitude; clamped to `[0,1]`; exact at every anchor
- **location** — the resolver chain with `navigator.geolocation` and
  `navigator.permissions` mocked: stored override wins; denied; timeout; unsupported;
  coordinates rounded; *Not now* persisted

## Out of scope

Second hand, sunrise/sunset time labels on the rim, digital readout, rotating dial,
multiple saved locations, and any server component. The app is static and stays that
way.
