import { useEffect, useRef, useState } from 'react';
import { type City, loadCities, offsetsDiffer, searchCities } from '../lib/cities';
import { deviceTimezone, utcOffsetLabel } from '../lib/location';
import { ModalSheet } from './ModalSheet';

interface Props {
  canLocate: boolean;
  onChooseCity: (city: City) => void;
  onUseDeviceLocation: () => void;
  onClose: () => void;
}

/**
 * The location chooser, as a dialog over the clock rather than a panel below
 * it — expanding in the flex column stole height from the clock stage and
 * visibly shrank the dial on every open and keystroke.
 */
export function CityPickerModal({ canLocate, onChooseCity, onUseDeviceLocation, onClose }: Props) {
  const [cities, setCities] = useState<City[] | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // The dataset is only fetched once the picker is actually opened.
  useEffect(() => {
    void loadCities().then(setCities);
  }, []);

  const results = cities ? searchCities(cities, query) : [];
  const zone = deviceTimezone();

  return (
    <ModalSheet labelledBy="picker-title" onClose={onClose} initialFocusRef={searchRef} dismissOnScrim>
      <h2 id="picker-title">Change location</h2>

      <div className="picker-body">
        {canLocate && (
          <button
            type="button"
            onClick={() => {
              onUseDeviceLocation();
              onClose();
            }}
          >
            Use my location
          </button>
        )}

        <label className="field">
          <span>Or pick a city</span>
          <input
            ref={searchRef}
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
                  onChooseCity(city);
                  onClose();
                }}
              >
                {city.name}, {city.country}
                {offsetsDiffer(city.tz, zone) && <span className="muted"> — {utcOffsetLabel(city.tz)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalSheet>
  );
}
