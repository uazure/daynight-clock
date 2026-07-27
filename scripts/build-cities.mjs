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
