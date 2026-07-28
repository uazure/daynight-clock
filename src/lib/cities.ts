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
