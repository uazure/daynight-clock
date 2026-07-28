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
  const tzMismatch = place.tz && place.tz !== zone

  return (
    <section className="panel">
      <p className="place">
        <strong>{place.label}</strong> · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}{' '}
        <span className="muted">({SOURCE_TEXT[place.source]})</span>{' '}
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {open ? 'close' : 'change'}
        </button>
      </p>

      {/*
        Persists after a city is chosen — not just while its row is visible
        in the search results — because the dial always shows the device's
        local time, never the selected city's, and that must stay visible
        for as long as the two disagree.
      */}
      {tzMismatch && (
        <p className="muted tz-note">
          {utcOffsetLabel(place.tz ?? zone)} vs your {utcOffsetLabel(zone)}; the dial
          shows your local time.
        </p>
      )}

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
                      — {utcOffsetLabel(city.tz)} vs your {utcOffsetLabel(zone)}; dial
                      shows your time
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
