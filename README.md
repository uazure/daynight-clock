# daynight-clock

A 24-hour analog clock. One full turn of the hour hand is one full day, and the
dial is shaded by the actual light at your location: daylight, dawn and dusk on
either side, and night.

Noon sits at the top and midnight at the bottom, so the hand points up when the
sun is up.

## Running it

    npm install
    npm run dev

## Building

    npm run build

The output in `dist/` is fully static and uses relative paths, so it runs from any
static host, from any subdirectory, or straight from a plain file. It is also a PWA
and works offline once loaded.

## Deployment

Live at [daynight-clock.azure.pp.ua](https://daynight-clock.azure.pp.ua), on Cloudflare
Pages.

## How the shading works

Rather than solving for sunrise and sunset and filling the wedges between them,
the app samples the sun's altitude once per minute of the day in that location's
own timezone (`src/lib/sun.ts`) and maps each sample to a lightness value
(`src/lib/lightness.ts`):

| Sun altitude | Dial                                          |
| ------------ | --------------------------------------------- |
| above +6°    | full daylight, flat                           |
| +6°…-6°      | the transition, eased so both ends join flat  |
| -0.35°       | sunrise/sunset — the gradient's midpoint      |
| -6°…-24°     | night, with a very shallow fade to the floor  |
| below -24°   | deep-night floor, flat                        |

The window is narrow on purpose, and deliberately **not** the civil, nautical
and astronomical twilight bands. This is a clock for a city: clear-sky
illuminance is about 3.4 lx at -6°, while urban street lighting delivers 5–30 lx
at ground level, so below roughly -6° a city street has stopped getting darker
even though the sky keeps dimming for another 12°. Anchoring on -12° and -18°
spent a quarter of the dial's contrast on a distinction nobody standing in a
city can see, and left mid-latitude summer nights washed out grey because the
old floor at -30° was never reached. The shallow fade below -6° exists only so
polar-night dials still show where solar noon is.

Sampling altitude instead of solving for events means polar day and polar night
need no special case — the dial simply comes out uniformly light or uniformly
dark. Solar positions come from [suncalc](https://github.com/mourner/suncalc),
whose `getPosition` reports *apparent* (refraction-corrected) altitude — which
is why the horizon here is -0.35° and not the geometric -0.833°.

A thin band in the corridor just outside the rim can run from sunrise to sunset, so
the two instants are marked explicitly rather than only by where the shading turns.
Polar day makes it a complete ring and polar night removes it; near the polar circles
there are days when daylight wraps midnight and it becomes two bands, one at each end
of the dial. It is **off by default** — the face already says where sunrise and
sunset are — and switched on in the settings.

## Your own times

Up to five times of your own can be shaded onto the face: a moment, like a
wake-up, or a stretch of the day, like work — and a stretch may run past midnight.
They are drawn in one warm accent, the only colour on the dial that is not the
sun's doing, at four weights that say where you are in your day:

| Weight             | What it is                                       |
| ------------------ | ------------------------------------------------ |
| faintest           | a stretch that has finished                      |
| quiet              | one that has not started yet                     |
| stronger           | the part of the one in progress already elapsed   |
| strongest          | the part of it still to come                     |

So the block you are inside visibly shrinks as the day goes on, and the seam
between its two halves is where the hour hand is. Whichever boundary comes next is
marked with a crisp line across the band, and the middle of the dial counts down
to it — *Work ends, in 1h 45m*. After the last one of the day it wraps to the
first one tomorrow, so it is never blank.

Add them under **Settings → Your times**. Times are the dial's own wall clock, so
they follow the place you picked along with the hands.

## Controls

Everything lives behind the burger button in the top-left corner: **Settings** for
the theme, the daylight arc, your own times and the location, **Full screen** where
the browser supports it, and **What is this?** for the short version of the idea. The footer
under the dial names the place, its coordinates and where that guess came from,
with a `change` link straight to the city picker. Nothing covers the dial on the
first run; on a phone the dialogs open full screen.

On a tall screen the dial sits a little above centre rather than dead centre —
centred looks low once the footer text is pulling the eye down.

## Location

The clock needs only a rough position; it never asks for a precise one.

1. A city you picked yourself, if you picked one. An explicit choice wins over
   everything below it, on every later visit, until you clear it — with
   *Use my location*, or with *Use my timezone*, which drops back to tier 3
   below without asking the browser for anything.
2. A coarse browser geolocation fix, rounded to about a kilometer. Nothing is
   requested on load: the fix happens only when you press *Use my location* in
   the city picker, next to the line saying what is collected. If you have
   already granted the permission on a previous visit, it happens without a
   dialog — the browser has none left to show.
3. Otherwise, a guess from your device's timezone: the largest city in that
   IANA zone, or — if the zone name is one the bundled table does not carry —
   any zone at the same UTC offset, which the panel labels as the rougher guess
   it is.
4. If even that fails, `0, 0`, shown as an unknown location with a prompt to
   pick a city.

Whichever tier answers, the dial shows **that place's own** local time. Pick Tokyo
from Prague and the shading moves to Tokyo's daylight and the hands move to Tokyo's
clock; the panel notes both offsets whenever they differ.

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
