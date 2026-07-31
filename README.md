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
static host, from any subdirectory, or straight from a plain file. It is also a PWA
and works offline once loaded.

## Deployment

Live at [daynight-clock.azure.pp.ua](https://daynight-clock.azure.pp.ua), on Cloudflare
Pages.

## How the shading works

Rather than solving for sunrise and sunset and filling the wedges between them,
the app samples the sun's altitude once per minute of the day in that location's
own timezone (`src/lib/sun.ts`) and maps each sample to a lightness value (`src/lib/lightness.ts`)
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

1. A city you picked yourself, if you picked one. An explicit choice wins over
   everything below it, on every later visit, until you clear it with
   *Use my location*.
2. A coarse browser geolocation fix, rounded to about a kilometer. Nothing is
   requested on load: if the browser has not been asked yet, an explanation
   comes first and the fix only happens if you agree. If you have already
   granted the permission on a previous visit, the fix happens without another
   dialog — the browser has no dialog left to show.
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
