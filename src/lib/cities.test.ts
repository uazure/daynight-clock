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
