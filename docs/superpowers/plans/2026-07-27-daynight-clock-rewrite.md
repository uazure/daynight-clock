# daynight-clock Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2013 canvas/jQuery 24-hour day/night clock with a statically-buildable Vite + React + TypeScript app that renders the clock as an SVG, shading the dial by the sun's altitude at the viewer's approximate location.

**Architecture:** All math lives in pure, separately-tested modules under `src/lib/`; React only renders. The dial background is produced by sampling the sun's altitude every 6 minutes of the local day and mapping each sample to a luminance, which removes every polar-region special case. Location resolves synchronously (stored override → timezone guess) so the first paint is correct, then optionally sharpens via coarse geolocation behind an explanatory modal.

**Tech Stack:** Vite, React 19, TypeScript (strict), suncalc 2.x, Vitest, vite-plugin-pwa, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-27-daynight-clock-rewrite-design.md`

## Global Constraints

- TypeScript `strict: true`. No `any` in committed code.
- Vite `base: './'` — `dist/` must run from any subpath and from `file://`.
- `suncalc` 2.x ships its own types. Do **not** install `@types/suncalc`. Import as ESM named exports: `import { getPosition } from 'suncalc'`. **All suncalc angles are in degrees.**
- Nothing in `src/lib/` may import React or touch the DOM, except `location.ts`, which touches `navigator` and `localStorage` only.
- Geolocation is only ever requested with `enableHighAccuracy: false`, and returned coordinates are rounded to 2 decimal places before use or storage.
- Geolocation is never requested on page load without the user first acting on the explanation modal.
- Dial orientation: noon at top, midnight at bottom, clockwise.
- The dial always displays the device's local time.
- Generated data files under `src/data/` are committed. `scripts/build-cities.mjs` is a manual regeneration tool, never part of `npm run build`.
- Every task ends with a passing `npm run typecheck` and `npm test`.
- Commit at the end of every task.

---

### Task 1: Scaffold the project and delete the old implementation

**Files:**
- Delete: `daynight-clock.js`, `sunrise-sunset.js`, `index.html`, `jquery-1.8.3.min.js`, `no-coords.png`
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/vite-env.d.ts`

**Interfaces:**
- Consumes: nothing
- Produces: an `npm run dev` / `npm run build` / `npm run typecheck` / `npm test` script set that every later task relies on. `src/App.tsx` exports `default function App(): JSX.Element`.

- [ ] **Step 1: Remove the old implementation**

```bash
cd /c/Users/popov/dev/daynight-clock
git rm -q daynight-clock.js sunrise-sunset.js index.html jquery-1.8.3.min.js no-coords.png
```

The old code stays in git history. Nothing in the rewrite reads these files.

- [ ] **Step 2: Scaffold with the official Vite template**

Scaffolding into the current (non-empty) directory needs no interactive prompt because `docs/` and `.git/` are the only remaining entries:

```bash
npm create vite@latest . -- --template react-ts
```

If the CLI refuses because the directory is non-empty, answer "Ignore files and continue".

- [ ] **Step 3: Install dependencies**

```bash
npm install
npm install suncalc
npm install -D vitest
```

Do **not** install `@types/suncalc` — suncalc 2.x ships `index.d.ts`.

- [ ] **Step 4: Configure Vite and Vitest**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`environment: 'node'` is correct — no test in this plan renders a component.

- [ ] **Step 5: Add the scripts**

In `package.json`, set the `scripts` block to exactly:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc -b",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6: Replace the placeholder app**

`index.html` — set `<title>` to `Day/Night Clock` and keep the template's `<div id="root">` and module script.

`src/App.tsx`:

```tsx
export default function App() {
  return <main className="app">Day/Night Clock</main>
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/styles.css`:

```css
:root {
  --ink: hsl(220 14% 10%);
  --paper: hsl(220 12% 96%);
  color-scheme: light dark;
}

* { box-sizing: border-box; }

html, body, #root { height: 100%; margin: 0; }

body {
  background: hsl(220 10% 8%);
  color: var(--paper);
  font: 16px/1.4 system-ui, sans-serif;
}

.app {
  display: grid;
  place-items: center;
  height: 100%;
}
```

Delete `src/App.css` and `src/assets/` from the template.

- [ ] **Step 7: Verify the toolchain**

```bash
npm run typecheck && npm run build && npx vitest run --passWithNoTests
```

Expected: all three succeed, `dist/index.html` exists, and its asset URLs start with `./`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + React + TypeScript, remove 2013 implementation"
```

---

### Task 2: Geometry module

**Files:**
- Create: `src/lib/geometry.ts`
- Test: `src/lib/geometry.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `HOUR_ANGLE_DEG: 15`
  - `angleForHour(hour: number): number`
  - `interface Point { x: number; y: number }`
  - `toCartesian(radius: number, angleDeg: number): Point`
  - `sectorPath(innerRadius: number, outerRadius: number, startAngleDeg: number, endAngleDeg: number): string`

  Every later component builds its coordinates from these three functions. `sectorPath` with `innerRadius === 0` emits a pie slice rather than an annular wedge.

- [ ] **Step 1: Write the failing tests**

`src/lib/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { angleForHour, sectorPath, toCartesian } from './geometry'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9)

describe('angleForHour', () => {
  it('puts noon at the top and midnight at the bottom', () => {
    close(angleForHour(12), 0)
    close(angleForHour(0), -180)
    close(angleForHour(24), 180)
  })

  it('advances 15 degrees per hour', () => {
    close(angleForHour(18), 90)
    close(angleForHour(6), -90)
    close(angleForHour(13.5), 22.5)
  })
})

describe('toCartesian', () => {
  it('maps 0 degrees to straight up in SVG coordinates', () => {
    const p = toCartesian(100, 0)
    close(p.x, 0)
    close(p.y, -100)
  })

  it('turns clockwise on screen as the angle grows', () => {
    const right = toCartesian(100, 90)
    close(right.x, 100)
    close(right.y, 0)

    const down = toCartesian(100, 180)
    close(down.x, 0)
    close(down.y, 100)
  })

  it('preserves the radius', () => {
    const p = toCartesian(37, 123)
    close(Math.hypot(p.x, p.y), 37)
  })
})

describe('sectorPath', () => {
  it('starts an annular wedge at the outer edge of the start angle', () => {
    const d = sectorPath(50, 100, 0, 30)
    const start = toCartesian(100, 0)
    expect(d.startsWith(`M ${start.x.toFixed(4)} ${start.y.toFixed(4)}`)).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('mentions both radii in an annular wedge', () => {
    const d = sectorPath(50, 100, 0, 30)
    expect(d).toContain('A 100 100')
    expect(d).toContain('A 50 50')
  })

  it('emits a pie slice through the origin when the inner radius is zero', () => {
    const d = sectorPath(0, 100, 0, 30)
    expect(d.startsWith('M 0 0')).toBe(true)
    expect(d).toContain('A 100 100')
    expect(d).not.toContain('A 0 0')
  })

  it('sets the large-arc flag only past 180 degrees', () => {
    expect(sectorPath(0, 100, 0, 179)).toContain('A 100 100 0 0 1')
    expect(sectorPath(0, 100, 0, 181)).toContain('A 100 100 0 1 1')
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/geometry.test.ts`
Expected: FAIL — cannot resolve `./geometry`.

- [ ] **Step 3: Implement the module**

`src/lib/geometry.ts`:

```ts
/** Degrees of dial arc per hour: 360° / 24h. */
export const HOUR_ANGLE_DEG = 15

/**
 * Dial angle for an hour of the local day, in degrees.
 * 0° is straight up and angles grow clockwise, so noon sits at the top
 * and midnight at the bottom.
 */
export function angleForHour(hour: number): number {
  return (hour - 12) * HOUR_ANGLE_DEG
}

export interface Point {
  x: number
  y: number
}

/**
 * Polar to SVG-cartesian, with 0° up and positive angles clockwise on screen.
 * Same convention as the original `toDecart`.
 */
export function toCartesian(radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) }
}

const fmt = (n: number): string => n.toFixed(4)

/**
 * Path data for a wedge between two radii and two angles.
 * `innerRadius === 0` produces a pie slice through the origin.
 */
export function sectorPath(
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const largeArc = Math.abs(endAngleDeg - startAngleDeg) > 180 ? 1 : 0
  const outerStart = toCartesian(outerRadius, startAngleDeg)
  const outerEnd = toCartesian(outerRadius, endAngleDeg)

  const outerArc =
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ` +
    `${fmt(outerEnd.x)} ${fmt(outerEnd.y)}`

  if (innerRadius === 0) {
    return `M 0 0 L ${fmt(outerStart.x)} ${fmt(outerStart.y)} ${outerArc} Z`
  }

  const innerEnd = toCartesian(innerRadius, endAngleDeg)
  const innerStart = toCartesian(innerRadius, startAngleDeg)

  return (
    `M ${fmt(outerStart.x)} ${fmt(outerStart.y)} ${outerArc} ` +
    `L ${fmt(innerEnd.x)} ${fmt(innerEnd.y)} ` +
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ` +
    `${fmt(innerStart.x)} ${fmt(innerStart.y)} Z`
  )
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/geometry.test.ts && npm run typecheck`
Expected: 9 passing tests, clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry.ts src/lib/geometry.test.ts
git commit -m "Add dial geometry helpers"
```

---

### Task 3: Lightness ramp

**Files:**
- Create: `src/lib/lightness.ts`
- Test: `src/lib/lightness.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `LIGHTNESS_ANCHORS: ReadonlyArray<readonly [altitudeDeg: number, lightness: number]>`
  - `altitudeToLightness(altitudeDeg: number): number` — returns 0…1
  - `lightnessToFill(lightness: number): string` — an `hsl()` string for the dial
  - `contrastInk(lightness: number): string` — an `hsl()` string legible on that fill

  `altitudeToLightness` is the single place brightness is decided; `DayNightRing`, `Ticks`, and `HourLabels` all colour themselves through these three functions.

- [ ] **Step 1: Write the failing tests**

`src/lib/lightness.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  LIGHTNESS_ANCHORS,
  altitudeToLightness,
  contrastInk,
  lightnessToFill,
} from './lightness'

describe('altitudeToLightness', () => {
  it('returns exactly the anchor value at each anchor altitude', () => {
    for (const [altitude, lightness] of LIGHTNESS_ANCHORS) {
      expect(altitudeToLightness(altitude)).toBeCloseTo(lightness, 9)
    }
  })

  it('clamps above the brightest and below the darkest anchor', () => {
    const [darkestAlt, darkest] = LIGHTNESS_ANCHORS[0]
    const [brightestAlt, brightest] = LIGHTNESS_ANCHORS[LIGHTNESS_ANCHORS.length - 1]

    expect(altitudeToLightness(darkestAlt - 40)).toBeCloseTo(darkest, 9)
    expect(altitudeToLightness(brightestAlt + 40)).toBeCloseTo(brightest, 9)
    expect(altitudeToLightness(90)).toBeCloseTo(brightest, 9)
  })

  it('interpolates linearly between two anchors', () => {
    // Midway between -12 (0.32) and -6 (0.58).
    expect(altitudeToLightness(-9)).toBeCloseTo(0.45, 9)
  })

  it('never decreases as the sun climbs', () => {
    let previous = -Infinity
    for (let altitude = -90; altitude <= 90; altitude += 0.25) {
      const current = altitudeToLightness(altitude)
      expect(current).toBeGreaterThanOrEqual(previous)
      previous = current
    }
  })

  it('stays inside 0..1 across the whole domain', () => {
    for (let altitude = -90; altitude <= 90; altitude += 0.25) {
      const value = altitudeToLightness(altitude)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('is dark at night, mid at civil twilight, bright in daylight', () => {
    expect(altitudeToLightness(-25)).toBeLessThan(0.15)
    expect(altitudeToLightness(-3)).toBeGreaterThan(0.6)
    expect(altitudeToLightness(30)).toBe(1)
  })
})

describe('lightnessToFill', () => {
  it('produces a darker hsl string for a darker input', () => {
    expect(lightnessToFill(0)).toMatch(/^hsl\(/)
    expect(lightnessToFill(0)).not.toBe(lightnessToFill(1))
  })
})

describe('contrastInk', () => {
  it('inks dark on a bright dial and light on a dark dial', () => {
    expect(contrastInk(0.95)).toBe(contrastInk(0.8))
    expect(contrastInk(0.1)).toBe(contrastInk(0.2))
    expect(contrastInk(0.95)).not.toBe(contrastInk(0.1))
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/lightness.test.ts`
Expected: FAIL — cannot resolve `./lightness`.

- [ ] **Step 3: Implement the module**

`src/lib/lightness.ts`:

```ts
/**
 * Sun altitude (degrees) → dial lightness (0..1), as a piecewise-linear ramp.
 * Anchors are the conventional twilight boundaries, so the ring reads as a
 * smooth gradient while the thresholds stay visible as inflection points.
 * Must stay sorted ascending by altitude.
 */
export const LIGHTNESS_ANCHORS = [
  [-30, 0.06], // deep night floor
  [-18, 0.14], // astronomical twilight ends
  [-12, 0.32], // nautical twilight ends
  [-6, 0.58], // civil twilight ends
  [-0.833, 0.88], // sunrise / sunset, refraction-corrected
  [6, 1.0], // full daylight
] as const satisfies ReadonlyArray<readonly [number, number]>

export function altitudeToLightness(altitudeDeg: number): number {
  const first = LIGHTNESS_ANCHORS[0]
  const last = LIGHTNESS_ANCHORS[LIGHTNESS_ANCHORS.length - 1]

  if (altitudeDeg <= first[0]) return first[1]
  if (altitudeDeg >= last[0]) return last[1]

  for (let i = 1; i < LIGHTNESS_ANCHORS.length; i += 1) {
    const [highAlt, highLight] = LIGHTNESS_ANCHORS[i]
    if (altitudeDeg > highAlt) continue

    const [lowAlt, lowLight] = LIGHTNESS_ANCHORS[i - 1]
    const t = (altitudeDeg - lowAlt) / (highAlt - lowAlt)
    return lowLight + t * (highLight - lowLight)
  }

  return last[1]
}

/** Single hue, so the dial reads as one monochrome luminance scale. */
const HUE = 220
const SATURATION = 12

/** Maps 0..1 onto a 5%..96% HSL lightness band. */
export function lightnessToFill(lightness: number): string {
  const percent = 5 + lightness * 91
  return `hsl(${HUE} ${SATURATION}% ${percent.toFixed(1)}%)`
}

/** Ink that stays legible on the fill produced for the same lightness. */
export function contrastInk(lightness: number): string {
  return lightness > 0.5
    ? `hsl(${HUE} ${SATURATION}% 12%)`
    : `hsl(${HUE} ${SATURATION}% 92%)`
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/lightness.test.ts && npm run typecheck`
Expected: 8 passing tests, clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lightness.ts src/lib/lightness.test.ts
git commit -m "Add sun-altitude to dial-lightness ramp"
```

---

### Task 4: Sun sampling

**Files:**
- Create: `src/lib/sun.ts`
- Test: `src/lib/sun.test.ts`

**Interfaces:**
- Consumes: `altitudeToLightness` from `src/lib/lightness.ts`
- Produces:
  - `SAMPLES_PER_DAY: 240`
  - `MINUTES_PER_SAMPLE: 6`
  - `interface DayProfile { altitudes: Float64Array; lightness: Float64Array }`
  - `sampleDay(dayStart: Date, lat: number, lon: number): DayProfile`
  - `localDateKey(now: Date): string` — `YYYY-MM-DD`
  - `startOfLocalDay(dateKey: string): Date` — takes the key, not a `Date`, so that `useDayProfile` can memoize on the key alone with honest dependencies
  - `hoursSinceLocalMidnight(now: Date): number` — fractional hours, 0…24

  `sampleDay` takes an absolute instant so it is timezone-independent and testable; `startOfLocalDay` is the only function that consults the device timezone. `useDayProfile` (Task 7) memoizes on `localDateKey`.

- [ ] **Step 1: Write the failing tests**

`src/lib/sun.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  MINUTES_PER_SAMPLE,
  SAMPLES_PER_DAY,
  hoursSinceLocalMidnight,
  localDateKey,
  sampleDay,
  startOfLocalDay,
} from './sun'
import { altitudeToLightness } from './lightness'

/** Index of the sample covering a given UTC instant of a UTC-midnight-based day. */
const sampleAt = (hoursUtc: number) => (hoursUtc * 60) / MINUTES_PER_SAMPLE

describe('sampleDay', () => {
  it('covers the day at the declared resolution', () => {
    const profile = sampleDay(new Date('2026-06-21T00:00:00Z'), 50.45, 30.52)
    expect(profile.altitudes).toHaveLength(SAMPLES_PER_DAY)
    expect(profile.lightness).toHaveLength(SAMPLES_PER_DAY)
    expect((SAMPLES_PER_DAY * MINUTES_PER_SAMPLE) / 60).toBe(24)
  })

  it('matches known solar altitudes', () => {
    // Values produced by suncalc 2.0.1 itself; they anchor the wiring,
    // not the astronomy. Degrees, not radians.
    const kyivJune = sampleDay(new Date('2026-06-21T00:00:00Z'), 50.45, 30.52)
    expect(kyivJune.altitudes[sampleAt(9)]).toBeCloseTo(60.6058, 3)

    const kyivDec = sampleDay(new Date('2026-12-21T00:00:00Z'), 50.45, 30.52)
    expect(kyivDec.altitudes[sampleAt(9)]).toBeCloseTo(15.1439, 3)

    const quito = sampleDay(new Date('2026-03-20T00:00:00Z'), -0.18, -78.47)
    expect(quito.altitudes[sampleAt(17)]).toBeCloseTo(84.6757, 3)

    const sydney = sampleDay(new Date('2026-01-15T00:00:00Z'), -33.87, 151.21)
    expect(sydney.altitudes[sampleAt(2)]).toBeCloseTo(77.2407, 3)
  })

  it('reports polar day as an all-positive profile', () => {
    const { altitudes } = sampleDay(new Date('2026-06-21T00:00:00Z'), 78.22, 15.65)
    expect(Math.min(...altitudes)).toBeGreaterThan(0)
  })

  it('reports polar night as an all-negative profile', () => {
    const { altitudes } = sampleDay(new Date('2026-12-21T00:00:00Z'), 78.22, 15.65)
    expect(Math.max(...altitudes)).toBeLessThan(0)
  })

  it('derives lightness from altitude through the shared ramp', () => {
    const { altitudes, lightness } = sampleDay(
      new Date('2026-06-21T00:00:00Z'),
      50.45,
      30.52,
    )
    for (let i = 0; i < SAMPLES_PER_DAY; i += 37) {
      expect(lightness[i]).toBeCloseTo(altitudeToLightness(altitudes[i]), 12)
    }
  })

  it('gives a polar-night dial no bright samples', () => {
    const { lightness } = sampleDay(new Date('2026-12-21T00:00:00Z'), 78.22, 15.65)
    expect(Math.max(...lightness)).toBeLessThan(0.35)
  })
})

describe('startOfLocalDay', () => {
  it('turns a date key into local midnight', () => {
    const start = startOfLocalDay('2026-07-27')
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(6)
    expect(start.getDate()).toBe(27)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
  })

  it('round-trips with localDateKey', () => {
    const key = localDateKey(new Date(2026, 6, 27, 14, 33, 12, 500))
    expect(localDateKey(startOfLocalDay(key))).toBe(key)
  })
})

describe('localDateKey', () => {
  it('formats the local date zero-padded', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDateKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('hoursSinceLocalMidnight', () => {
  it('converts local wall time to fractional hours', () => {
    expect(hoursSinceLocalMidnight(new Date(2026, 6, 27, 0, 0, 0))).toBeCloseTo(0, 9)
    expect(hoursSinceLocalMidnight(new Date(2026, 6, 27, 6, 30, 0))).toBeCloseTo(6.5, 9)
    expect(hoursSinceLocalMidnight(new Date(2026, 6, 27, 23, 59, 60))).toBeCloseTo(24, 9)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/sun.test.ts`
Expected: FAIL — cannot resolve `./sun`.

- [ ] **Step 3: Implement the module**

`src/lib/sun.ts`:

```ts
import { getPosition } from 'suncalc'
import { altitudeToLightness } from './lightness'

/** One sample per 6 minutes of the day. */
export const SAMPLES_PER_DAY = 240
export const MINUTES_PER_SAMPLE = (24 * 60) / SAMPLES_PER_DAY

export interface DayProfile {
  /** Sun altitude in degrees at each sample, index 0 = `dayStart`. */
  altitudes: Float64Array
  /** Dial lightness 0..1 at each sample. */
  lightness: Float64Array
}

/**
 * Samples the sun's altitude across the 24 hours starting at `dayStart`.
 *
 * Sampling altitude rather than solving for sunrise and sunset means polar day
 * and polar night need no special case: the profile simply comes out uniformly
 * positive or uniformly negative.
 */
export function sampleDay(dayStart: Date, lat: number, lon: number): DayProfile {
  const altitudes = new Float64Array(SAMPLES_PER_DAY)
  const lightness = new Float64Array(SAMPLES_PER_DAY)
  const stepMs = MINUTES_PER_SAMPLE * 60_000
  const startMs = dayStart.getTime()

  for (let i = 0; i < SAMPLES_PER_DAY; i += 1) {
    const altitude = getPosition(new Date(startMs + i * stepMs), lat, lon).altitude
    altitudes[i] = altitude
    lightness[i] = altitudeToLightness(altitude)
  }

  return { altitudes, lightness }
}

/** `YYYY-MM-DD` in local time — the memo key for a day's profile. */
export function localDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Local midnight for a `YYYY-MM-DD` key. Keyed by the string rather than by a
 * `Date` so that a memo over the day's profile can depend on the key alone.
 */
export function startOfLocalDay(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Fractional hours since local midnight, for placing the hands. */
export function hoursSinceLocalMidnight(now: Date): number {
  return (
    now.getHours() +
    now.getMinutes() / 60 +
    now.getSeconds() / 3600 +
    now.getMilliseconds() / 3_600_000
  )
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/sun.test.ts && npm run typecheck`
Expected: 10 passing tests, clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sun.ts src/lib/sun.test.ts
git commit -m "Add sun altitude day sampling"
```

---

### Task 5: Generate and validate the location datasets

**Files:**
- Create: `scripts/build-cities.mjs`
- Create: `src/data/cities.json` (generated, committed — consumed by Task 8)
- Create: `src/data/timezone-coords.json` (generated, committed)
- Create: `src/data/README.md`
- Test: `src/data/data.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces two committed JSON artifacts consumed by Tasks 6 and 9:
  - `cities.json` — `Array<[name: string, country: string, lat: number, lon: number, tz: string]>`, sorted by population descending
  - `timezone-coords.json` — `Record<string, [lat: number, lon: number]>`, one entry per IANA zone

  Tuple arrays rather than objects, to keep the payload small. Task 6 imports `timezone-coords.json` statically; Task 8 imports `cities.json` dynamically.

- [ ] **Step 1: Fetch the source data**

GeoNames only publishes `cities15000` as a zip, and Node has no zip reader, so the download and extraction are manual and done once:

```bash
mkdir -p /c/Users/popov/AppData/Local/Temp/geonames && cd /c/Users/popov/AppData/Local/Temp/geonames && curl -fSL -o cities15000.zip https://download.geonames.org/export/dump/cities15000.zip && tar -xf cities15000.zip && wc -l cities15000.txt
```

`tar -xf` reads zip archives via bsdtar, which ships with Windows 10+ and macOS. Expected: roughly 26,000–27,000 lines.

- [ ] **Step 2: Write the generator**

`scripts/build-cities.mjs`:

```js
// Regenerates src/data/cities.json and src/data/timezone-coords.json from the
// GeoNames cities15000 dump (CC BY 4.0). Run manually; not part of the build.
//
//   node scripts/build-cities.mjs <path-to-cities15000.txt>
//
// Download: https://download.geonames.org/export/dump/cities15000.zip

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIN_POPULATION = 200_000

// Tab-separated column indices, per the GeoNames readme.
const COL = { asciiname: 2, lat: 4, lon: 5, country: 8, population: 14, tz: 17 }

const source = process.argv[2]
if (!source) {
  console.error('usage: node scripts/build-cities.mjs <path-to-cities15000.txt>')
  process.exit(1)
}

const round = (value) => Math.round(Number(value) * 10_000) / 10_000

const rows = readFileSync(source, 'utf8')
  .split('\n')
  .filter((line) => line.length > 0)
  .map((line) => line.split('\t'))
  .map((cols) => ({
    name: cols[COL.asciiname],
    country: cols[COL.country],
    lat: round(cols[COL.lat]),
    lon: round(cols[COL.lon]),
    tz: cols[COL.tz],
    population: Number(cols[COL.population]) || 0,
  }))
  .filter(
    (row) =>
      row.name && row.tz && Number.isFinite(row.lat) && Number.isFinite(row.lon),
  )
  .sort((a, b) => b.population - a.population)

// One representative per IANA zone: the most populous city in it. Built from
// every row, not just the large ones, so sparse zones are still covered.
const zones = {}
for (const row of rows) {
  if (!(row.tz in zones)) zones[row.tz] = [row.lat, row.lon]
}

const cities = rows
  .filter((row) => row.population >= MIN_POPULATION)
  .map((row) => [row.name, row.country, row.lat, row.lon, row.tz])

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const write = (file, data) =>
  writeFileSync(join(outDir, file), `${JSON.stringify(data)}\n`, 'utf8')

write('cities.json', cities)
write('timezone-coords.json', Object.fromEntries(Object.entries(zones).sort()))

console.log(`cities.json: ${cities.length} cities (population >= ${MIN_POPULATION})`)
console.log(`timezone-coords.json: ${Object.keys(zones).length} zones`)
```

- [ ] **Step 3: Generate the data**

```bash
node scripts/build-cities.mjs /c/Users/popov/AppData/Local/Temp/geonames/cities15000.txt
```

Expected: roughly 1,200–1,700 cities and 350–450 zones. `cities.json` should be under 100 KB.

- [ ] **Step 4: Document provenance**

`src/data/README.md`:

```markdown
# Generated location data

Both JSON files here are generated — do not hand-edit them. Regenerate with:

    node scripts/build-cities.mjs <path-to-cities15000.txt>

- `cities.json` — `[name, countryCode, lat, lon, ianaTimezone]`, population >= 200,000,
  sorted by population descending. Loaded on demand by the location panel.
- `timezone-coords.json` — `{ ianaTimezone: [lat, lon] }`, the most populous city in
  each zone. Bundled, because the location resolver needs it on the first frame.

Source: [GeoNames](https://www.geonames.org/) `cities15000`, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
```

Append the same attribution to the repo `README.md` under a `## Data` heading.

- [ ] **Step 5: Write the validation tests**

These guard the committed artifacts against a bad regeneration.

`src/data/data.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import rawCities from './cities.json'
import rawZones from './timezone-coords.json'

// TypeScript infers a widened `(string | number)[][]` for a JSON array this
// large, so the tuple shape has to be asserted before the assertions read well.
type CityTuple = [string, string, number, number, string]

const cities = rawCities as unknown as CityTuple[]
const zones = rawZones as unknown as Record<string, [number, number]>

const IANA = /^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$|^UTC$/

describe('cities.json', () => {
  it('holds a useful number of cities', () => {
    expect(cities.length).toBeGreaterThan(1_000)
    expect(cities.length).toBeLessThan(3_000)
  })

  it('is a well-formed tuple array throughout', () => {
    for (const entry of cities) {
      expect(entry).toHaveLength(5)
      const [name, country, lat, lon, tz] = entry
      expect(typeof name).toBe('string')
      expect(name.length).toBeGreaterThan(0)
      expect(country).toMatch(/^[A-Z]{2}$/)
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(lat).toBeLessThanOrEqual(90)
      expect(lon).toBeGreaterThanOrEqual(-180)
      expect(lon).toBeLessThanOrEqual(180)
      expect(tz).toMatch(IANA)
    }
  })

  it('leads with large cities', () => {
    const names = cities.slice(0, 60).map(([name]) => name)
    expect(names).toContain('Tokyo')
  })
})

describe('timezone-coords.json', () => {
  it('covers a plausible number of zones', () => {
    const keys = Object.keys(zones)
    expect(keys.length).toBeGreaterThan(300)
    expect(keys.length).toBeLessThan(600)
  })

  it('maps every zone to a valid coordinate pair', () => {
    for (const [zone, coords] of Object.entries(zones)) {
      expect(zone).toMatch(IANA)
      expect(coords).toHaveLength(2)
      const [lat, lon] = coords
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(lat).toBeLessThanOrEqual(90)
      expect(lon).toBeGreaterThanOrEqual(-180)
      expect(lon).toBeLessThanOrEqual(180)
    }
  })

  it('includes the zones the resolver is most likely to see', () => {
    for (const zone of [
      'America/New_York',
      'America/Sao_Paulo',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Australia/Sydney',
      'Europe/Berlin',
      'Europe/London',
    ]) {
      expect(zones).toHaveProperty(zone)
    }
  })

  it('places a spot-checked zone near the right city', () => {
    const [lat, lon] = zones['Asia/Tokyo']
    expect(lat).toBeCloseTo(35.7, 0)
    expect(lon).toBeCloseTo(139.7, 0)
  })
})
```

- [ ] **Step 6: Confirm JSON imports typecheck**

The Vite `react-ts` template sets `resolveJsonModule: true`; if `tsc` complains about the two imports, add it under `compilerOptions` in `tsconfig.app.json`. The test glob `src/**/*.test.ts` already matches `src/data/data.test.ts`, so Vitest needs no change.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/data/data.test.ts && npm run typecheck`
Expected: 7 passing tests, clean typecheck.

If the `Tokyo` assertion fails, print `cities.slice(0, 60)` and substitute a city that is genuinely present — GeoNames occasionally labels the top entry differently. Do not weaken the assertion into a bare `length` check.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-cities.mjs src/data README.md
git commit -m "Generate committed city and timezone coordinate datasets"
```

---

### Task 6: Location resolver

**Files:**
- Create: `src/lib/location.ts`
- Test: `src/lib/location.test.ts`

**Interfaces:**
- Consumes: `src/data/timezone-coords.json` from Task 5
- Produces:
  - `type LocationSource = 'manual' | 'gps' | 'timezone' | 'fallback'`
  - `interface Place { lat: number; lon: number; label: string; source: LocationSource }`
  - `type GeoPermission = 'granted' | 'prompt' | 'denied' | 'unsupported'`
  - `roundCoord(value: number): number`
  - `loadOverride(): Place | null`
  - `saveOverride(place: Place): void`
  - `clearOverride(): void`
  - `isPromptDismissed(): boolean`
  - `dismissPrompt(): void`
  - `placeFromTimezone(): Place`
  - `resolveInitialPlace(): Place`
  - `geolocationPermission(): Promise<GeoPermission>`
  - `requestCoarsePosition(): Promise<Place>`
  - `deviceTimezone(): string`
  - `utcOffsetLabel(timeZone: string, at?: Date): string`

  `resolveInitialPlace` is synchronous, so `useLocation` (Task 7) has a correct place on the first render. `utcOffsetLabel` powers the timezone-mismatch warning in Task 9.

**Notes for the implementer:**
- `getCurrentPosition` must be called with `enableHighAccuracy: false`. This is a project constraint, not a preference — a test asserts it.
- Coordinates are rounded to 2 decimals (~1 km) everywhere they enter the app. The clock cannot resolve finer than that, so nothing sharper is retained.
- IANA zone names drift. Resolution order is: exact hit → alias map → scan the table for a zone whose current UTC offset matches the device's → `0, 0` fallback.

- [ ] **Step 1: Write the failing tests**

`src/lib/location.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearOverride,
  deviceTimezone,
  dismissPrompt,
  geolocationPermission,
  isPromptDismissed,
  loadOverride,
  placeFromTimezone,
  requestCoarsePosition,
  resolveInitialPlace,
  roundCoord,
  saveOverride,
  utcOffsetLabel,
  type Place,
} from './location'

/** Minimal in-memory localStorage, enough for the four keys this module uses. */
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('roundCoord', () => {
  it('keeps two decimals, about a kilometre', () => {
    expect(roundCoord(50.4501)).toBe(50.45)
    expect(roundCoord(30.523456)).toBe(30.52)
    expect(roundCoord(-0.187)).toBe(-0.19)
    expect(roundCoord(0)).toBe(0)
  })
})

describe('the stored override', () => {
  const kyiv: Place = { lat: 50.45, lon: 30.52, label: 'Kyiv, UA', source: 'manual' }

  it('is absent to begin with', () => {
    expect(loadOverride()).toBeNull()
  })

  it('round-trips through storage', () => {
    saveOverride(kyiv)
    expect(loadOverride()).toEqual(kyiv)
  })

  it('rounds coordinates on the way in', () => {
    saveOverride({ ...kyiv, lat: 50.456789, lon: 30.5111 })
    expect(loadOverride()).toEqual({ ...kyiv, lat: 50.46, lon: 30.51 })
  })

  it('is always tagged manual, whatever it was tagged before', () => {
    saveOverride({ ...kyiv, source: 'gps' })
    expect(loadOverride()?.source).toBe('manual')
  })

  it('clears', () => {
    saveOverride(kyiv)
    clearOverride()
    expect(loadOverride()).toBeNull()
  })

  it('ignores corrupt stored JSON rather than throwing', () => {
    localStorage.setItem('daynight.place', '{not json')
    expect(loadOverride()).toBeNull()
  })

  it('ignores stored objects missing coordinates', () => {
    localStorage.setItem('daynight.place', JSON.stringify({ label: 'nowhere' }))
    expect(loadOverride()).toBeNull()
  })
})

describe('the dismissed-prompt flag', () => {
  it('starts unset and persists once set', () => {
    expect(isPromptDismissed()).toBe(false)
    dismissPrompt()
    expect(isPromptDismissed()).toBe(true)
  })
})

describe('placeFromTimezone', () => {
  it('resolves the device zone to coordinates', () => {
    const place = placeFromTimezone()
    expect(place.source).toBe('timezone')
    expect(Number.isFinite(place.lat)).toBe(true)
    expect(Number.isFinite(place.lon)).toBe(true)
    expect(place.lat).toBeGreaterThanOrEqual(-90)
    expect(place.lat).toBeLessThanOrEqual(90)
  })

  it('resolves a renamed zone through the alias map', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/Kiev' }),
    } as unknown as Intl.DateTimeFormat)

    const place = placeFromTimezone()
    expect(place.source).toBe('timezone')
    expect(place.lat).toBeCloseTo(50.4, 0)
    expect(place.lon).toBeCloseTo(30.5, 0)
  })

  it('falls back to 0,0 tagged fallback for an unknown zone with no offset match', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Mars/Olympus_Mons' }),
      format: () => '',
    } as unknown as Intl.DateTimeFormat)

    const place = placeFromTimezone()
    expect(place.source).toBe('fallback')
    expect(place.lat).toBe(0)
    expect(place.lon).toBe(0)
  })
})

describe('resolveInitialPlace', () => {
  it('prefers a stored override over the timezone guess', () => {
    const manual: Place = { lat: 10, lon: 20, label: 'Somewhere', source: 'manual' }
    saveOverride(manual)
    expect(resolveInitialPlace()).toEqual(manual)
  })

  it('falls back to the timezone guess when nothing is stored', () => {
    expect(resolveInitialPlace().source).not.toBe('manual')
  })

  it('never requests geolocation', () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    resolveInitialPlace()
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })
})

describe('geolocationPermission', () => {
  it('reports unsupported when the browser has no geolocation', async () => {
    vi.stubGlobal('navigator', {})
    await expect(geolocationPermission()).resolves.toBe('unsupported')
  })

  it('passes through the Permissions API state', async () => {
    for (const state of ['granted', 'prompt', 'denied'] as const) {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state }) },
      })
      await expect(geolocationPermission()).resolves.toBe(state)
    }
  })

  it('assumes prompt when the Permissions API is missing', async () => {
    vi.stubGlobal('navigator', { geolocation: {} })
    await expect(geolocationPermission()).resolves.toBe('prompt')
  })

  it('assumes prompt when the Permissions API rejects', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {},
      permissions: { query: vi.fn().mockRejectedValue(new Error('nope')) },
    })
    await expect(geolocationPermission()).resolves.toBe('prompt')
  })
})

describe('requestCoarsePosition', () => {
  it('asks for low accuracy only, with a cache window and a timeout', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => {
      ok({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition)
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await requestCoarsePosition()

    const options = getCurrentPosition.mock.calls[0][2] as PositionOptions
    expect(options.enableHighAccuracy).toBe(false)
    expect(options.maximumAge).toBe(900_000)
    expect(options.timeout).toBe(8_000)
  })

  it('returns a rounded place tagged gps', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({
            coords: { latitude: 50.456789, longitude: 30.512345 },
          } as GeolocationPosition),
      },
    })

    const place = await requestCoarsePosition()
    expect(place).toEqual({ lat: 50.46, lon: 30.51, label: 'Your location', source: 'gps' })
  })

  it('rejects when the browser has no geolocation', async () => {
    vi.stubGlobal('navigator', {})
    await expect(requestCoarsePosition()).rejects.toThrow(/not supported/i)
  })

  it('rejects with the browser error when the user denies', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, fail?: PositionErrorCallback) =>
          fail?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError),
      },
    })
    await expect(requestCoarsePosition()).rejects.toThrow(/denied/i)
  })
})

describe('utcOffsetLabel', () => {
  it('formats a positive and a negative offset', () => {
    const midJanuary = new Date('2026-01-15T12:00:00Z')
    expect(utcOffsetLabel('Asia/Tokyo', midJanuary)).toBe('UTC+9')
    expect(utcOffsetLabel('America/New_York', midJanuary)).toBe('UTC-5')
  })

  it('formats UTC itself without a sign', () => {
    expect(utcOffsetLabel('UTC', new Date('2026-01-15T12:00:00Z'))).toBe('UTC')
  })

  it('includes the minutes for a half-hour zone', () => {
    expect(utcOffsetLabel('Asia/Kolkata', new Date('2026-01-15T12:00:00Z'))).toBe(
      'UTC+5:30',
    )
  })
})

describe('deviceTimezone', () => {
  it('returns a non-empty zone name', () => {
    expect(deviceTimezone().length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/location.test.ts`
Expected: FAIL — cannot resolve `./location`.

- [ ] **Step 3: Implement the module**

`src/lib/location.ts`:

```ts
import timezoneCoords from '../data/timezone-coords.json'

export type LocationSource = 'manual' | 'gps' | 'timezone' | 'fallback'

export interface Place {
  lat: number
  lon: number
  label: string
  source: LocationSource
}

export type GeoPermission = 'granted' | 'prompt' | 'denied' | 'unsupported'

const PLACE_KEY = 'daynight.place'
const PROMPT_KEY = 'daynight.geoPromptDismissed'

const ZONES = timezoneCoords as Record<string, [number, number]>

/**
 * Zones renamed since the GeoNames dump was cut. The table is keyed by the
 * older name, so modern ICU output needs redirecting.
 */
const ZONE_ALIASES: Record<string, string> = {
  'Europe/Kyiv': 'Europe/Kiev',
  'Asia/Kolkata': 'Asia/Calcutta',
  'Asia/Ho_Chi_Minh': 'Asia/Saigon',
  'Asia/Yangon': 'Asia/Rangoon',
  'Asia/Kathmandu': 'Asia/Katmandu',
  'America/Argentina/Buenos_Aires': 'America/Buenos_Aires',
  'Europe/Istanbul': 'Asia/Istanbul',
  'Pacific/Honolulu': 'US/Hawaii',
}

/** ~1 km. The dial cannot resolve finer, so nothing finer is kept. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Current UTC offset of a zone, in minutes. */
function zoneOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value

    if (!name) return null
    if (name === 'GMT') return 0

    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name)
    if (!match) return null

    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0))
  } catch {
    return null
  }
}

/** `UTC`, `UTC+9`, `UTC-5`, `UTC+5:30`. */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string {
  const minutes = zoneOffsetMinutes(timeZone, at)
  if (minutes === null) return timeZone
  if (minutes === 0) return 'UTC'

  const sign = minutes < 0 ? '-' : '+'
  const total = Math.abs(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60

  return rest === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(rest).padStart(2, '0')}`
}

export function placeFromTimezone(): Place {
  const zone = deviceTimezone()
  const direct = ZONES[zone] ?? ZONES[ZONE_ALIASES[zone] ?? '']

  if (direct) {
    return { lat: direct[0], lon: direct[1], label: zone, source: 'timezone' }
  }

  // Unknown zone name: settle for any zone at the same current offset. Wrong
  // latitude is possible, but far better than defaulting to the equator.
  const now = new Date()
  const target = zoneOffsetMinutes(zone, now)
  if (target !== null) {
    for (const [candidate, coords] of Object.entries(ZONES)) {
      if (zoneOffsetMinutes(candidate, now) === target) {
        return { lat: coords[0], lon: coords[1], label: zone, source: 'timezone' }
      }
    }
  }

  return { lat: 0, lon: 0, label: 'Unknown location', source: 'fallback' }
}

export function loadOverride(): Place | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const { lat, lon, label } = parsed as Partial<Place>
    if (typeof lat !== 'number' || typeof lon !== 'number') return null
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

    return {
      lat: roundCoord(lat),
      lon: roundCoord(lon),
      label: typeof label === 'string' && label ? label : 'Saved location',
      source: 'manual',
    }
  } catch {
    return null
  }
}

export function saveOverride(place: Place): void {
  const stored: Place = {
    lat: roundCoord(place.lat),
    lon: roundCoord(place.lon),
    label: place.label,
    source: 'manual',
  }
  localStorage.setItem(PLACE_KEY, JSON.stringify(stored))
}

export function clearOverride(): void {
  localStorage.removeItem(PLACE_KEY)
}

export function isPromptDismissed(): boolean {
  return localStorage.getItem(PROMPT_KEY) === '1'
}

export function dismissPrompt(): void {
  localStorage.setItem(PROMPT_KEY, '1')
}

/**
 * The place to render on the very first frame. Synchronous by design, and it
 * never touches geolocation — that only happens after the user acts on the
 * explanation modal.
 */
export function resolveInitialPlace(): Place {
  return loadOverride() ?? placeFromTimezone()
}

export async function geolocationPermission(): Promise<GeoPermission> {
  if (!navigator.geolocation) return 'unsupported'
  if (!navigator.permissions?.query) return 'prompt'

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'prompt'
  }
}

/**
 * Coarse position only: sunrise and sunset move by seconds over a kilometre,
 * so there is no reason to ask the device for anything sharper.
 */
export function requestCoarsePosition(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: roundCoord(position.coords.latitude),
          lon: roundCoord(position.coords.longitude),
          label: 'Your location',
          source: 'gps',
        }),
      (error) => reject(new Error(error.message || 'Could not get your location')),
      { enableHighAccuracy: false, maximumAge: 900_000, timeout: 8_000 },
    )
  })
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/location.test.ts && npm run typecheck`
Expected: 27 passing tests, clean typecheck.

Two assertions are worth reading the failure of carefully rather than adjusting:
- If the `Europe/Kiev` alias test fails, `timezone-coords.json` uses `Europe/Kyiv` — invert that entry in `ZONE_ALIASES` instead of deleting the test.
- If `utcOffsetLabel('UTC', …)` fails, check what `timeZoneName: 'longOffset'` produced; some ICU builds emit `GMT` and others `GMT+0`. Both must map to `'UTC'`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/location.ts src/lib/location.test.ts
git commit -m "Add location resolver with coarse-only geolocation"
```

---

### Task 7: Render the clock

Hooks and components ship together: a hook with no renderer proves nothing, and the deliverable here is a clock on screen shaded by the real sun.

**Files:**
- Create: `src/lib/dial.ts`
- Test: `src/lib/dial.test.ts`
- Create: `src/hooks/useNow.ts`
- Create: `src/hooks/useDayProfile.ts`
- Create: `src/components/DayNightRing.tsx`
- Create: `src/components/Ticks.tsx`
- Create: `src/components/HourLabels.tsx`
- Create: `src/components/Hands.tsx`
- Create: `src/components/Clock.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `angleForHour`, `sectorPath`, `toCartesian` (Task 2); `lightnessToFill`, `contrastInk` (Task 3); `SAMPLES_PER_DAY`, `sampleDay`, `startOfLocalDay`, `localDateKey`, `hoursSinceLocalMidnight`, `DayProfile` (Task 4); `resolveInitialPlace`, `Place` (Task 6)
- Produces:
  - `DIAL` — the radius constants every dial component measures from
  - `sampleIndexForHour(hour: number): number`
  - `useNow(intervalMs?: number): Date`
  - `useDayProfile(now: Date, lat: number, lon: number): DayProfile`
  - `<Clock now={Date} profile={DayProfile} />`

  Task 8 mounts `<Clock>` unchanged and only adds chrome around it.

- [ ] **Step 1: Write the failing test for the dial constants**

`src/lib/dial.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DIAL, sampleIndexForHour } from './dial'
import { SAMPLES_PER_DAY } from './sun'

describe('DIAL', () => {
  it('nests every radius inside the face', () => {
    for (const radius of [
      DIAL.hourTickInner,
      DIAL.hourTickInnerStrong,
      DIAL.hourLabel,
      DIAL.hourHand,
      DIAL.minuteHand,
      DIAL.hub,
    ]) {
      expect(radius).toBeGreaterThan(0)
      expect(radius).toBeLessThanOrEqual(DIAL.face)
    }
  })

  it('fits inside the 200-unit viewBox with room for the stroke', () => {
    expect(DIAL.face).toBeLessThan(100)
  })

  it('draws emphasised ticks longer than plain ones', () => {
    expect(DIAL.hourTickInnerStrong).toBeLessThan(DIAL.hourTickInner)
  })

  it('keeps the hour hand shorter than the minute hand, as on a 24h dial', () => {
    expect(DIAL.hourHand).toBeLessThan(DIAL.minuteHand)
  })
})

describe('sampleIndexForHour', () => {
  it('maps midnight to the first sample', () => {
    expect(sampleIndexForHour(0)).toBe(0)
  })

  it('maps noon to the middle sample', () => {
    expect(sampleIndexForHour(12)).toBe(SAMPLES_PER_DAY / 2)
  })

  it('wraps the end of the day back to the first sample', () => {
    expect(sampleIndexForHour(24)).toBe(0)
  })

  it('stays in range for every hour of the day', () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const index = sampleIndexForHour(hour)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(SAMPLES_PER_DAY)
      expect(Number.isInteger(index)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/dial.test.ts`
Expected: FAIL — cannot resolve `./dial`.

- [ ] **Step 3: Implement the dial constants**

`src/lib/dial.ts`:

```ts
import { SAMPLES_PER_DAY } from './sun'

/**
 * Radii in viewBox units. The viewBox is `-100 -100 200 200`, so the face has
 * to stay under 100 to leave room for its own stroke.
 */
export const DIAL = {
  face: 92,
  hourTickInner: 84,
  hourTickInnerStrong: 77,
  hourLabel: 68,
  hourHand: 58,
  minuteHand: 74,
  hub: 4.5,
} as const

/** Which day-profile sample covers a given hour of the local day. */
export function sampleIndexForHour(hour: number): number {
  const index = Math.round((hour / 24) * SAMPLES_PER_DAY)
  return ((index % SAMPLES_PER_DAY) + SAMPLES_PER_DAY) % SAMPLES_PER_DAY
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run src/lib/dial.test.ts`
Expected: 8 passing tests.

- [ ] **Step 5: Write the two hooks**

`src/hooks/useNow.ts`:

```ts
import { useEffect, useState } from 'react'

/**
 * The current instant, refreshed on an interval. Ten seconds is plenty: the
 * dial has no second hand, so the minute hand moves 1° per interval at most.
 */
export function useNow(intervalMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
```

`src/hooks/useDayProfile.ts`:

```ts
import { useMemo } from 'react'
import {
  localDateKey,
  sampleDay,
  startOfLocalDay,
  type DayProfile,
} from '../lib/sun'

/**
 * The day's light profile, recomputed only when the local date or the location
 * changes — 240 solar-position calls are far too many to repeat every tick.
 */
export function useDayProfile(now: Date, lat: number, lon: number): DayProfile {
  const dateKey = localDateKey(now)

  return useMemo(
    () => sampleDay(startOfLocalDay(dateKey), lat, lon),
    [dateKey, lat, lon],
  )
}
```

- [ ] **Step 6: Write the ring**

`src/components/DayNightRing.tsx`:

```tsx
import { memo } from 'react'
import { DIAL } from '../lib/dial'
import { sectorPath } from '../lib/geometry'
import { lightnessToFill } from '../lib/lightness'
import { SAMPLES_PER_DAY } from '../lib/sun'

const SLICE_DEG = 360 / SAMPLES_PER_DAY
/** Slices overlap slightly, so antialiasing leaves no hairline seams. */
const OVERLAP_DEG = 0.08

interface Props {
  lightness: Float64Array
}

/**
 * The dial face. Sample 0 is local midnight, which sits at the bottom, so the
 * first slice starts at -180°.
 */
export const DayNightRing = memo(function DayNightRing({ lightness }: Props) {
  const slices = []

  for (let i = 0; i < lightness.length; i += 1) {
    const start = -180 + i * SLICE_DEG
    slices.push(
      <path
        key={i}
        d={sectorPath(0, DIAL.face, start, start + SLICE_DEG + OVERLAP_DEG)}
        fill={lightnessToFill(lightness[i])}
      />,
    )
  }

  return <g>{slices}</g>
})
```

- [ ] **Step 7: Write the ticks and labels**

Both colour themselves from the lightness beneath them, which is why the dial stays legible from polar night to polar day without a second palette.

`src/components/Ticks.tsx`:

```tsx
import { memo } from 'react'
import { DIAL, sampleIndexForHour } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { contrastInk } from '../lib/lightness'

interface Props {
  lightness: Float64Array
}

export const Ticks = memo(function Ticks({ lightness }: Props) {
  const ticks = []

  for (let hour = 0; hour < 24; hour += 1) {
    const strong = hour % 3 === 0
    const angle = angleForHour(hour)
    const outer = toCartesian(DIAL.face, angle)
    const inner = toCartesian(
      strong ? DIAL.hourTickInnerStrong : DIAL.hourTickInner,
      angle,
    )

    ticks.push(
      <line
        key={hour}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={contrastInk(lightness[sampleIndexForHour(hour)])}
        strokeWidth={strong ? 1.6 : 0.6}
        strokeLinecap="round"
      />,
    )
  }

  return <g>{ticks}</g>
})
```

`src/components/HourLabels.tsx`:

```tsx
import { memo } from 'react'
import { DIAL, sampleIndexForHour } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { contrastInk } from '../lib/lightness'

interface Props {
  lightness: Float64Array
}

/** Every third hour, matching the settings the 2013 page actually used. */
export const HourLabels = memo(function HourLabels({ lightness }: Props) {
  const labels = []

  for (let hour = 0; hour < 24; hour += 3) {
    const at = toCartesian(DIAL.hourLabel, angleForHour(hour))

    labels.push(
      <text
        key={hour}
        x={at.x}
        y={at.y}
        fill={contrastInk(lightness[sampleIndexForHour(hour)])}
        fontSize={7}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {hour}
      </text>,
    )
  }

  return <g>{labels}</g>
})
```

- [ ] **Step 8: Write the hands**

Each hand is drawn twice: a wide translucent halo under a narrow dark core, so it stays visible crossing both the bright and the dark side of the dial without depending on blend-mode support.

`src/components/Hands.tsx`:

```tsx
import { DIAL } from '../lib/dial'
import { angleForHour, toCartesian } from '../lib/geometry'
import { hoursSinceLocalMidnight } from '../lib/sun'

const HALO = 'hsl(220 12% 96% / 0.55)'
const CORE = 'hsl(220 14% 10%)'

interface HandProps {
  angle: number
  length: number
  width: number
}

function Hand({ angle, length, width }: HandProps) {
  const tip = toCartesian(length, angle)
  const tail = toCartesian(-DIAL.hub, angle)

  return (
    <g>
      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke={HALO}
        strokeWidth={width + 1.6}
        strokeLinecap="round"
      />
      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke={CORE}
        strokeWidth={width}
        strokeLinecap="round"
      />
    </g>
  )
}

interface Props {
  now: Date
}

export function Hands({ now }: Props) {
  const hours = hoursSinceLocalMidnight(now)
  // One turn per hour: 6° per minute, 0 minutes straight up.
  const minuteAngle = (now.getMinutes() + now.getSeconds() / 60) * 6

  return (
    <g>
      <Hand angle={minuteAngle} length={DIAL.minuteHand} width={1.4} />
      <Hand angle={angleForHour(hours)} length={DIAL.hourHand} width={3.4} />
      <circle r={DIAL.hub} fill={CORE} stroke={HALO} strokeWidth={1} />
    </g>
  )
}
```

- [ ] **Step 9: Assemble the clock**

`src/components/Clock.tsx`:

```tsx
import { DayNightRing } from './DayNightRing'
import { Hands } from './Hands'
import { HourLabels } from './HourLabels'
import { Ticks } from './Ticks'
import { DIAL } from '../lib/dial'
import type { DayProfile } from '../lib/sun'

interface Props {
  now: Date
  profile: DayProfile
}

export function Clock({ now, profile }: Props) {
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <svg
      className="clock"
      viewBox="-100 -100 200 200"
      role="img"
      aria-label={`24-hour day and night clock, ${time}`}
    >
      <DayNightRing lightness={profile.lightness} />
      <circle
        r={DIAL.face}
        fill="none"
        stroke="hsl(220 14% 10% / 0.35)"
        strokeWidth={1}
      />
      <Ticks lightness={profile.lightness} />
      <HourLabels lightness={profile.lightness} />
      <Hands now={now} />
    </svg>
  )
}
```

- [ ] **Step 10: Wire it into the app**

`src/App.tsx` — the location panel and the consent modal arrive in Task 8; for now the synchronous resolver is enough to prove the dial.

```tsx
import { useState } from 'react'
import { Clock } from './components/Clock'
import { useDayProfile } from './hooks/useDayProfile'
import { useNow } from './hooks/useNow'
import { resolveInitialPlace, type Place } from './lib/location'

export default function App() {
  const [place] = useState<Place>(resolveInitialPlace)
  const now = useNow()
  const profile = useDayProfile(now, place.lat, place.lon)

  return (
    <main className="app">
      <Clock now={now} profile={profile} />
      <p className="place">
        {place.label} · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}
      </p>
    </main>
  )
}
```

Append to `src/styles.css`:

```css
.app {
  grid-template-rows: 1fr auto;
  gap: 1rem;
  padding: 1rem;
}

.clock {
  display: block;
  width: min(100vw - 2rem, 100vh - 6rem);
  height: auto;
  margin: auto;
}

.place {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  opacity: 0.7;
}
```

- [ ] **Step 11: Verify the whole suite and the typecheck**

Run: `npm test && npm run typecheck`
Expected: every test from Tasks 2–7 passes; clean typecheck.

- [ ] **Step 12: Look at it**

```bash
npm run dev
```

Open the printed URL and check all five:
1. The dial is bright across the daylight hours and dark across the night, with visible twilight ramps on both sides.
2. `12` sits at the top, `0` at the bottom, and the numbers increase clockwise.
3. The hour hand points at the current hour on the 24-hour scale — at 3pm it is a quarter-turn past the top, not pointing at 3.
4. Ticks and numbers are readable over both the bright and the dark part of the dial.
5. No hairline seams between ring slices.

If the ring looks inverted — dark by day, bright by night — the likely cause is a sign error in the slice start angle, not the sun math; check `Task 4`'s tests still pass before touching anything else.

- [ ] **Step 13: Commit**

```bash
git add src/lib/dial.ts src/lib/dial.test.ts src/hooks src/components src/App.tsx src/styles.css
git commit -m "Render the 24-hour day/night dial as SVG"
```

---

### Task 8: Consent modal, city search, and location panel

**Files:**
- Create: `src/lib/cities.ts`
- Test: `src/lib/cities.test.ts`
- Create: `src/hooks/useLocation.ts`
- Create: `src/components/GeolocationPrompt.tsx`
- Create: `src/components/LocationPanel.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: everything from Task 6, `src/data/cities.json` from Task 5, `<Clock>` from Task 7
- Produces:
  - `interface City { name: string; country: string; lat: number; lon: number; tz: string }`
  - `loadCities(): Promise<City[]>`
  - `searchCities(cities: City[], query: string, limit?: number): City[]`
  - `cityToPlace(city: City): Place`
  - `useLocation(): LocationState`
  - `<GeolocationPrompt onAccept onDecline />`, `<LocationPanel … />`

**The two requirements this task exists to satisfy:**
1. The browser's permission dialog must never appear before the user has read an explanation and clicked *Use my location*. The only exception is a permission already in the `granted` state, where the browser shows no dialog at all.
2. Position is requested coarse-only. That is enforced in `requestCoarsePosition` (Task 6); this task must not add a second call site.

- [ ] **Step 1: Write the failing tests for city search**

`src/lib/cities.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cityToPlace, searchCities, type City } from './cities'

const city = (name: string, country = 'UA', lat = 50, lon = 30): City => ({
  name,
  country,
  lat,
  lon,
  tz: 'Europe/Kiev',
})

// Ordered by population, the way the dataset is.
const CITIES: City[] = [
  city('Tokyo', 'JP', 35.69, 139.69),
  city('Sao Paulo', 'BR', -23.55, -46.63),
  city('Kyiv'),
  city('Kryvyi Rih'),
  city('New York City', 'US', 40.71, -74.01),
  city('York', 'GB', 53.96, -1.08),
]

describe('searchCities', () => {
  it('returns nothing for an empty or blank query', () => {
    expect(searchCities(CITIES, '')).toEqual([])
    expect(searchCities(CITIES, '   ')).toEqual([])
  })

  it('matches a name prefix, case-insensitively', () => {
    expect(searchCities(CITIES, 'kyi').map((c) => c.name)).toEqual(['Kyiv'])
    expect(searchCities(CITIES, 'TOK').map((c) => c.name)).toEqual(['Tokyo'])
  })

  it('ranks a whole-name prefix above a later-word match', () => {
    expect(searchCities(CITIES, 'york').map((c) => c.name)).toEqual([
      'York',
      'New York City',
    ])
  })

  it('falls back to a substring match, ranked last', () => {
    expect(searchCities(CITIES, 'ao pau').map((c) => c.name)).toEqual(['Sao Paulo'])
  })

  it('accepts a trailing country code', () => {
    expect(searchCities(CITIES, 'tokyo jp').map((c) => c.name)).toEqual(['Tokyo'])
  })

  it('ignores diacritics in the query', () => {
    expect(searchCities([city('Malmo', 'SE')], 'malmö').map((c) => c.name)).toEqual([
      'Malmo',
    ])
  })

  it('breaks ties by dataset order, so bigger cities come first', () => {
    const names = searchCities(CITIES, 'k').map((c) => c.name)
    expect(names.indexOf('Kyiv')).toBeLessThan(names.indexOf('Kryvyi Rih'))
  })

  it('honours the limit', () => {
    expect(searchCities(CITIES, 'k', 1)).toHaveLength(1)
  })

  it('returns nothing when nothing matches', () => {
    expect(searchCities(CITIES, 'zzzz')).toEqual([])
  })
})

describe('cityToPlace', () => {
  it('labels the place with name and country and tags it manual', () => {
    expect(cityToPlace(city('Kyiv'))).toEqual({
      lat: 50,
      lon: 30,
      label: 'Kyiv, UA',
      source: 'manual',
    })
  })

  it('rounds the coordinates like every other entry point', () => {
    const place = cityToPlace(city('Kyiv', 'UA', 50.456789, 30.512345))
    expect(place.lat).toBe(50.46)
    expect(place.lon).toBe(30.51)
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/cities.test.ts`
Expected: FAIL — cannot resolve `./cities`.

- [ ] **Step 3: Implement the city module**

`src/lib/cities.ts`:

```ts
import { roundCoord, type Place } from './location'

export interface City {
  name: string
  country: string
  lat: number
  lon: number
  tz: string
}

type CityTuple = [name: string, country: string, lat: number, lon: number, tz: string]

let cache: City[] | null = null

/**
 * Loads the city dataset on demand. Kept out of the initial bundle because the
 * clock itself never needs it — only the location panel does.
 */
export async function loadCities(): Promise<City[]> {
  if (cache) return cache

  // Widened by TypeScript's JSON inference; the tuple shape is guaranteed by
  // the generator and asserted in `src/data/data.test.ts`.
  const loaded = (await import('../data/cities.json')) as unknown as {
    default: CityTuple[]
  }
  cache = loaded.default.map(([name, country, lat, lon, tz]) => ({
    name,
    country,
    lat,
    lon,
    tz,
  }))

  return cache
}

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Ranked search: whole-name prefix, then later-word prefix, then substring.
 * The dataset is ordered by population, and the sort is stable, so ties come
 * back with the larger city first.
 */
export function searchCities(cities: City[], query: string, limit = 8): City[] {
  const q = normalize(query).trim()
  if (!q) return []

  const scored: Array<{ city: City; score: number }> = []

  for (const city of cities) {
    const name = normalize(city.name)
    const withCountry = `${name} ${normalize(city.country)}`

    let score: number
    if (name.startsWith(q) || withCountry.startsWith(q)) score = 0
    else if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) score = 1
    else if (name.includes(q)) score = 2
    else continue

    scored.push({ city, score })
  }

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.city)
}

export function cityToPlace(city: City): Place {
  return {
    lat: roundCoord(city.lat),
    lon: roundCoord(city.lon),
    label: `${city.name}, ${city.country}`,
    source: 'manual',
  }
}
```

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx vitest run src/lib/cities.test.ts && npm run typecheck`
Expected: 11 passing tests, clean typecheck.

- [ ] **Step 5: Write the location hook**

`src/hooks/useLocation.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { cityToPlace, type City } from '../lib/cities'
import {
  clearOverride,
  dismissPrompt,
  geolocationPermission,
  isPromptDismissed,
  placeFromTimezone,
  requestCoarsePosition,
  resolveInitialPlace,
  saveOverride,
  type GeoPermission,
  type Place,
} from '../lib/location'

export interface LocationState {
  place: Place
  permission: GeoPermission
  error: string | null
  /** True while the explanation modal should be on screen. */
  askingConsent: boolean
  acceptConsent: () => void
  declineConsent: () => void
  chooseCity: (city: City) => void
  useDeviceLocation: () => void
}

export function useLocation(): LocationState {
  const [place, setPlace] = useState<Place>(resolveInitialPlace)
  const [permission, setPermission] = useState<GeoPermission>('unsupported')
  const [error, setError] = useState<string | null>(null)
  const [askingConsent, setAskingConsent] = useState(false)

  const locate = useCallback(async () => {
    setError(null)
    try {
      setPlace(await requestCoarsePosition())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not get your location')
      setPermission(await geolocationPermission())
    }
  }, [])

  // Decide once, on mount, whether to ask. Nothing here can trigger a browser
  // permission dialog except the `granted` branch, where there is no dialog.
  useEffect(() => {
    let cancelled = false

    void geolocationPermission().then((state) => {
      if (cancelled) return
      setPermission(state)

      if (state === 'granted') {
        void locate()
        return
      }

      const stored = resolveInitialPlace()
      if (state === 'prompt' && !isPromptDismissed() && stored.source !== 'manual') {
        setAskingConsent(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [locate])

  const acceptConsent = useCallback(() => {
    setAskingConsent(false)
    dismissPrompt()
    void locate()
  }, [locate])

  const declineConsent = useCallback(() => {
    setAskingConsent(false)
    dismissPrompt()
  }, [])

  const chooseCity = useCallback((city: City) => {
    const chosen = cityToPlace(city)
    saveOverride(chosen)
    setPlace(chosen)
    setError(null)
  }, [])

  const useDeviceLocation = useCallback(() => {
    clearOverride()
    setPlace(placeFromTimezone())
    void locate()
  }, [locate])

  return {
    place,
    permission,
    error,
    askingConsent,
    acceptConsent,
    declineConsent,
    chooseCity,
    useDeviceLocation,
  }
}
```

- [ ] **Step 6: Write the consent modal**

The copy matters — it is the whole reason the modal exists. Use it verbatim.

`src/components/GeolocationPrompt.tsx`:

```tsx
interface Props {
  onAccept: () => void
  onDecline: () => void
}

export function GeolocationPrompt({ onAccept, onDecline }: Props) {
  return (
    <div className="scrim" role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="geo-title"
      >
        <h2 id="geo-title">Show sunrise and sunset where you are?</h2>
        <p>
          The clock shades the dial with the hours of daylight, twilight and night
          at your location. To work that out it needs a rough idea of where you
          are — roughly, not precisely: it asks for a low-accuracy fix and rounds
          it to about a kilometre.
        </p>
        <p>
          Your coordinates stay on this device. There is no server, and nothing is
          sent anywhere.
        </p>
        <p className="sheet-note">
          Your browser will ask for permission next. You can skip this and pick a
          city by hand instead.
        </p>
        <div className="sheet-actions">
          <button type="button" onClick={onDecline}>
            Not now
          </button>
          <button type="button" className="primary" onClick={onAccept}>
            Use my location
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Write the location panel**

`src/components/LocationPanel.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { loadCities, searchCities, type City } from '../lib/cities'
import { deviceTimezone, utcOffsetLabel, type Place } from '../lib/location'

interface Props {
  place: Place
  error: string | null
  canLocate: boolean
  onChooseCity: (city: City) => void
  onUseDeviceLocation: () => void
}

const SOURCE_TEXT: Record<Place['source'], string> = {
  manual: 'chosen by you',
  gps: 'from your device',
  timezone: 'guessed from your timezone',
  fallback: 'unknown — pick a city below',
}

export function LocationPanel({
  place,
  error,
  canLocate,
  onChooseCity,
  onUseDeviceLocation,
}: Props) {
  const [open, setOpen] = useState(false)
  const [cities, setCities] = useState<City[] | null>(null)
  const [query, setQuery] = useState('')

  // The dataset is only fetched once the panel is actually opened.
  useEffect(() => {
    if (!open || cities) return
    void loadCities().then(setCities)
  }, [open, cities])

  const results = cities ? searchCities(cities, query) : []
  const zone = deviceTimezone()

  return (
    <section className="panel">
      <p className="place">
        <strong>{place.label}</strong> · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}{' '}
        <span className="muted">({SOURCE_TEXT[place.source]})</span>{' '}
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {open ? 'close' : 'change'}
        </button>
      </p>

      {error && <p className="error">{error}</p>}

      {open && (
        <div className="panel-body">
          {canLocate && (
            <button type="button" onClick={onUseDeviceLocation}>
              Use my location
            </button>
          )}

          <label className="field">
            <span>Or pick a city</span>
            <input
              type="search"
              value={query}
              placeholder="Start typing a city name"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {!cities && <p className="muted">Loading cities…</p>}

          <ul className="results">
            {results.map((city) => (
              <li key={`${city.name}-${city.country}-${city.lat}`}>
                <button
                  type="button"
                  onClick={() => {
                    onChooseCity(city)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {city.name}, {city.country}
                  {city.tz !== zone && (
                    <span className="muted">
                      {' '}
                      — {utcOffsetLabel(city.tz)}, your device is{' '}
                      {utcOffsetLabel(zone)}; the dial keeps showing your local time
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 8: Wire both into the app**

Replace `src/App.tsx`:

```tsx
import { Clock } from './components/Clock'
import { GeolocationPrompt } from './components/GeolocationPrompt'
import { LocationPanel } from './components/LocationPanel'
import { useDayProfile } from './hooks/useDayProfile'
import { useLocation } from './hooks/useLocation'
import { useNow } from './hooks/useNow'

export default function App() {
  const location = useLocation()
  const now = useNow()
  const profile = useDayProfile(now, location.place.lat, location.place.lon)

  return (
    <main className="app">
      <Clock now={now} profile={profile} />

      <LocationPanel
        place={location.place}
        error={location.error}
        canLocate={location.permission !== 'unsupported' && location.permission !== 'denied'}
        onChooseCity={location.chooseCity}
        onUseDeviceLocation={location.useDeviceLocation}
      />

      {location.askingConsent && (
        <GeolocationPrompt
          onAccept={location.acceptConsent}
          onDecline={location.declineConsent}
        />
      )}
    </main>
  )
}
```

Append to `src/styles.css`:

```css
.scrim {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: hsl(220 20% 4% / 0.7);
}

.sheet {
  max-width: 34rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: hsl(220 14% 14%);
  box-shadow: 0 1rem 3rem hsl(220 30% 2% / 0.5);
}

.sheet h2 { margin: 0 0 0.75rem; font-size: 1.15rem; }
.sheet p { margin: 0 0 0.75rem; font-size: 0.9rem; opacity: 0.85; }
.sheet-note { font-size: 0.8rem !important; opacity: 0.6 !important; }

.sheet-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

button {
  padding: 0.45rem 0.9rem;
  border: 1px solid hsl(220 12% 40%);
  border-radius: 0.4rem;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

button.primary { background: hsl(220 12% 92%); color: hsl(220 14% 10%); border-color: transparent; }
button.link { padding: 0; border: none; text-decoration: underline; }

.panel { font-size: 0.85rem; text-align: center; }
.panel-body { display: grid; gap: 0.75rem; justify-items: center; margin-top: 0.75rem; }
.field { display: grid; gap: 0.25rem; }

.field input {
  padding: 0.4rem 0.6rem;
  border: 1px solid hsl(220 12% 40%);
  border-radius: 0.4rem;
  background: transparent;
  color: inherit;
  font: inherit;
}

.results { max-width: 34rem; margin: 0; padding: 0; list-style: none; text-align: left; }
.results button { display: block; width: 100%; border: none; text-align: left; }
.results button:hover { background: hsl(220 12% 20%); }

.muted { opacity: 0.6; }
.error { color: hsl(8 70% 70%); }
```

- [ ] **Step 9: Run the suite**

Run: `npm test && npm run typecheck`
Expected: all tests pass, clean typecheck.

- [ ] **Step 10: Verify the consent behaviour by hand**

This is the part the tests cannot cover, so walk all five paths. Use a fresh incognito window for each, and open DevTools first.

1. **First visit** — the explanation modal appears and **no browser permission dialog is shown behind it**. This is the requirement; if the browser prompt appears unprompted, stop and fix it.
2. **Accept** — clicking *Use my location* triggers the browser dialog; allowing it moves the dial's shading and the panel reads "from your device".
3. **Decline** — clicking *Not now* dismisses the modal and no browser dialog appears. Reload: the modal does not come back, and the panel still shows the timezone guess.
4. **Denied permission** — deny at the browser dialog. The panel shows an error, the *Use my location* button is gone, and the city search still works.
5. **Already granted** — with permission granted, reload: no modal, and the position resolves silently.

Also confirm in the Network tab that `cities` is fetched only when the panel is opened, never on load.

- [ ] **Step 11: Commit**

```bash
git add src/lib/cities.ts src/lib/cities.test.ts src/hooks/useLocation.ts src/components src/App.tsx src/styles.css
git commit -m "Add consent modal, city search, and location panel"
```

---

### Task 9: Offline support, CI, and documentation

**Files:**
- Modify: `vite.config.ts`, `index.html`, `package.json`, `README.md`
- Create: `public/icon.svg`, `public/favicon.svg`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the finished app from Task 8
- Produces: a `dist/` that installs and runs offline, and a workflow that publishes it

- [ ] **Step 1: Draw the icon**

One SVG serves as both favicon and PWA icon — a miniature of the dial itself, so no binary asset generation is needed. `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" width="512" height="512">
  <rect x="-100" y="-100" width="200" height="200" fill="hsl(220 12% 10%)"/>
  <path d="M 0 0 L 0 -92 A 92 92 0 0 1 0 92 Z" fill="hsl(220 12% 92%)"/>
  <path d="M 0 0 L 0 92 A 92 92 0 0 1 0 -92 Z" fill="hsl(220 12% 16%)"/>
  <circle r="92" fill="none" stroke="hsl(220 12% 55%)" stroke-width="3"/>
  <line x1="0" y1="6" x2="45" y2="-40" stroke="hsl(220 14% 10%)" stroke-width="8" stroke-linecap="round"/>
  <circle r="7" fill="hsl(220 14% 10%)"/>
</svg>
```

Copy it to `public/favicon.svg` as well, and point `index.html` at it:

```html
<link rel="icon" type="image/svg+xml" href="./favicon.svg" />
<meta name="theme-color" content="#171a1f" />
<meta name="description" content="A 24-hour analog clock whose dial is shaded by daylight, twilight and night at your location." />
```

Delete `public/vite.svg` from the template.

- [ ] **Step 2: Add the PWA plugin**

```bash
npm install -D vite-plugin-pwa
```

Update `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Day/Night Clock',
        short_name: 'Day/Night',
        description:
          'A 24-hour analog clock whose dial is shaded by daylight, twilight and night at your location.',
        theme_color: '#171a1f',
        background_color: '#171a1f',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

The app has no network dependency at runtime — the sun math, the timezone table and the city list are all bundled — so the default precache covers everything it needs.

- [ ] **Step 3: Verify the offline build**

```bash
npm run build && npx vite preview --port 4173
```

Then, in the browser at the preview URL:
1. DevTools → Application → Service Workers shows one activated worker.
2. DevTools → Network → check **Offline**, then reload. The clock still renders and the hands are still correct.
3. Open the location panel while offline — the city list still loads, because it is precached.

Stop the preview server when done.

- [ ] **Step 4: Confirm the build is path-independent**

```bash
grep -o 'src="[^"]*"' dist/index.html
```

Expected: every asset URL starts with `./`. Opening `dist/index.html` directly from the filesystem should also render the clock — the service worker will not register over `file://`, which is expected and harmless.

- [ ] **Step 5: Add the deploy workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Build and deploy

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Note for whoever enables this: GitHub Pages must be set to "GitHub Actions" as its source in the repository settings. The workflow cannot do that itself.

- [ ] **Step 6: Rewrite the README**

Replace `README.md` entirely:

```markdown
# daynight-clock

A 24-hour analog clock. One full turn of the hour hand is one full day, and the
dial is shaded by the actual light at your location: daylight, the twilight bands
on either side, and night.

Noon sits at the top and midnight at the bottom, so the hand points up when the
sun is up.

## Running it

    npm install
    npm run dev

## Building

    npm run build

The output in `dist/` is fully static and uses relative paths, so it runs from any
subdirectory, from a plain file, or from GitHub Pages. It is also a PWA and works
offline once loaded.

## How the shading works

Rather than solving for sunrise and sunset and filling the wedges between them,
the app samples the sun's altitude every six minutes of the local day
(`src/lib/sun.ts`) and maps each sample to a lightness value (`src/lib/lightness.ts`)
using the conventional twilight boundaries as anchors:

| Sun altitude | Meaning                     |
| ------------ | --------------------------- |
| above -0.83° | daylight                    |
| -0.83°…-6°   | civil twilight              |
| -6°…-12°     | nautical twilight           |
| -12°…-18°    | astronomical twilight       |
| below -18°   | night                       |

Sampling altitude instead of solving for events means polar day and polar night
need no special case — the dial simply comes out uniformly light or uniformly
dark. Solar positions come from [suncalc](https://github.com/mourner/suncalc).

## Location

The clock needs only a rough position; it never asks for a precise one.

1. A city you picked yourself, if you picked one.
2. A coarse browser geolocation fix, rounded to about a kilometre — and only
   after you have read the explanation and agreed. Nothing is requested on load.
3. Otherwise, a guess from your device's timezone.

Coordinates stay on your device. There is no server and no analytics.

## Data

City and timezone coordinates are generated from
[GeoNames](https://www.geonames.org/) `cities15000`, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See
`src/data/README.md` to regenerate them.

## History

The original 2013 version was a `<canvas>` clock written with jQuery. It lives on
in this repository's git history; nothing of it remains in the working tree except
the idea and the polar-coordinate convention.
```

- [ ] **Step 7: Run the full suite one last time**

```bash
npm run typecheck && npm test && npm run build
```

Expected: clean typecheck, every test passing, successful build.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add offline support, Pages deploy workflow, and documentation"
```

---

## Verification against the spec

Run through this once the last task is done.

- [ ] 24-hour dial, one turn of the hour hand per day — Task 7
- [ ] Noon at top, midnight at bottom, clockwise — Task 2 tests, Task 7 step 12
- [ ] Dial background shaded by daylight, twilight and night — Tasks 3, 4, 7
- [ ] All four twilight bands represented as a gradient ramp — Task 3 anchors
- [ ] Monochrome, single-hue luminance scale — `lightnessToFill` in Task 3
- [ ] SVG rendered by React — Task 7
- [ ] TypeScript, strict — global constraints
- [ ] Vite dev mode — Task 1
- [ ] Static build, relative paths — Task 1 step 7, Task 9 step 4
- [ ] Coarse geolocation only, rounded — Task 6, asserted by test
- [ ] Explanation modal before any permission dialog — Task 8, step 10 path 1
- [ ] Timezone fallback — Task 6
- [ ] Manual city override, searchable — Task 8
- [ ] Vitest on pure logic — Tasks 2–8
- [ ] PWA, offline — Task 9
- [ ] GitHub Pages workflow — Task 9
- [ ] Old implementation removed, history intact — Task 1
