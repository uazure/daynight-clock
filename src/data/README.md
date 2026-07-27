# Generated location data

Both JSON files here are generated — do not hand-edit them. Regenerate with:

    node scripts/build-cities.mjs <path-to-cities15000.txt>

- `cities.json` — `[name, countryCode, lat, lon, ianaTimezone]`, population >= 200,000,
  sorted by population descending. Loaded on demand by the location panel.
- `timezone-coords.json` — `{ ianaTimezone: [lat, lon] }`, the most populous city in
  each zone. Bundled, because the location resolver needs it on the first frame.

Source: [GeoNames](https://www.geonames.org/) `cities15000`, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
