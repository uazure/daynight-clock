import { type RefObject, useEffect, useRef, useState } from 'react';
import { type City, loadCities, offsetsDiffer, searchCities } from '../lib/cities';
import { deviceTimezone, utcOffsetLabel } from '../lib/location';
import { ModalSheet } from './ModalSheet';

interface Props {
  canLocate: boolean;
  /**
   * Whether to offer the way back to the device-timezone guess. False when the
   * current place *is* a guess, where the reset would land on what is already on
   * screen — an offer to undo nothing.
   */
  canReset: boolean;
  /** Passed straight through — see `ModalSheet`'s own note on the prop. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onChooseCity: (city: City) => void;
  onUseDeviceLocation: () => void;
  onUseTimezone: () => void;
  /**
   * Dismisses this sheet — which is not always the same as closing every sheet.
   * `App` sends it back to the settings sheet when that is what opened the
   * picker, so every exit from here (Close, Escape, the scrim, and each of the
   * choices below) returns the reader where they came from.
   */
  onClose: () => void;
}

/**
 * The location chooser, as a dialog over the clock rather than a panel below
 * it — expanding in the flex column stole height from the clock stage and
 * visibly shrank the dial on every open and keystroke.
 */
export function CityPickerModal({
  canLocate,
  canReset,
  restoreFocusRef,
  onChooseCity,
  onUseDeviceLocation,
  onUseTimezone,
  onClose,
}: Props) {
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
    <ModalSheet
      labelledBy="picker-title"
      title="Change location"
      onClose={onClose}
      initialFocusRef={searchRef}
      restoreFocusRef={restoreFocusRef}
      // The scrolling body *is* this sheet's layout column. A wrapper inside it
      // would be a second height for the results list to flex against, and on a
      // phone the list has to flex against the sheet's own.
      bodyClassName="picker-body"
    >
      {/*
          The note is not decoration: rule 4 is that a geolocation request never
          happens without the accuracy-and-privacy line visible *beside* the
          control that triggers it, and this is the only such control left in the
          app now that the first-run hint that used to carry both is gone. It is
          the objection someone has at the moment of deciding, so it belongs where
          the decision is made rather than in a dialog read before it.
        */}
      {canLocate && (
        <div className="picker-locate">
          <button
            type="button"
            onClick={() => {
              onUseDeviceLocation();
              onClose();
            }}
          >
            Use my location
          </button>
          <p className="sheet-note">Rounded to about a kilometre, and it never leaves this device.</p>
        </div>
      )}

      {/*
          The way back to the default, and the only one that asks the browser for
          nothing — *Use my location* above also clears a chosen city, but at the
          price of a geolocation fix. Named for what it does rather than "Reset":
          the zone in the label is what the dial will actually run on, which is
          the one thing worth knowing before pressing it.
        */}
      {canReset && (
        <button
          type="button"
          onClick={() => {
            onUseTimezone();
            onClose();
          }}
        >
          Use my timezone ({zone})
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
    </ModalSheet>
  );
}
