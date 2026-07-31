import { useMemo, useState } from 'react';
import { CityPickerModal } from './components/CityPickerModal';
import { Clock } from './components/Clock';
import { LocationHint } from './components/LocationHint';
import { LocationPanel } from './components/LocationPanel';
import { useDayProfile } from './hooks/useDayProfile';
import { useLocation } from './hooks/useLocation';
import { useNow } from './hooks/useNow';
import { deviceTimezone } from './lib/location';
import { sunEvents } from './lib/sun';

export default function App() {
  const location = useLocation();
  const now = useNow();
  const [pickerOpen, setPickerOpen] = useState(false);
  // `tz` is absent only for fallback places and pre-tz stored overrides;
  // the device zone is the only sensible reading of "local time" there.
  const timeZone = location.place.tz ?? deviceTimezone();
  const profile = useDayProfile(now, location.place.lat, location.place.lon, timeZone);
  // Keyed on the profile, so this rescans the samples only when they are
  // themselves recomputed — a new day in the place's zone, or a new place —
  // rather than on every tick of the second hand.
  const events = useMemo(() => sunEvents(profile.altitudes), [profile]);

  return (
    <main className="app">
      {/*
        `display: contents` (see styles.css) keeps this wrapper invisible to
        layout — the flex children below still belong directly to `.app` —
        while giving the picker something to make `inert` while it is open, so
        a keyboard or screen-reader user cannot reach the clock, the hint or
        the panel behind the scrim. The modal itself renders as a sibling,
        outside the inert subtree.
      */}
      <div className="app-content" inert={pickerOpen}>
        {/*
          The hint is positioned against the stage, not the panel, so that its
          arrival and dismissal never change the height the dial is sized from.
        */}
        <div className="clock-stage">
          <Clock now={now} profile={profile} timeZone={timeZone} />

          {location.hint && (
            <LocationHint
              source={location.hint}
              onUseLocation={location.useDeviceLocation}
              onOpenPicker={() => setPickerOpen(true)}
              onDismiss={location.dismissHint}
            />
          )}
        </div>

        <LocationPanel
          place={location.place}
          events={events}
          error={location.error}
          hideSource={location.hint !== null}
          onOpenPicker={() => setPickerOpen(true)}
        />
      </div>

      {pickerOpen && (
        <CityPickerModal
          canLocate={location.permission !== 'unsupported' && location.permission !== 'denied'}
          onChooseCity={location.chooseCity}
          onUseDeviceLocation={location.useDeviceLocation}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}
