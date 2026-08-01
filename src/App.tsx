import { useMemo, useState } from 'react';
import { CityPickerModal } from './components/CityPickerModal';
import { Clock } from './components/Clock';
import { LocationHint } from './components/LocationHint';
import { LocationPanel } from './components/LocationPanel';
import { MainMenu } from './components/MainMenu';
import { SettingsModal } from './components/SettingsModal';
import { useDayProfile } from './hooks/useDayProfile';
import { useFullscreen } from './hooks/useFullscreen';
import { useLocation } from './hooks/useLocation';
import { useNow } from './hooks/useNow';
import { useSettings } from './hooks/useSettings';
import { deviceTimezone } from './lib/location';
import { sunEvents } from './lib/sun';

/**
 * Which overlay is up, as one value rather than a boolean each.
 *
 * Three booleans would make "menu and settings both open" representable, and
 * the two would stack scrims and focus traps. One value cannot: opening any
 * overlay closes whatever was there, so the menu handing off to the settings
 * sheet is a replace, and so is the settings sheet handing off to the picker.
 */
type Overlay = null | 'menu' | 'settings' | 'picker';

export default function App() {
  const location = useLocation();
  const now = useNow();
  const fullscreen = useFullscreen();
  const [showSunArc, setShowSunArc] = useSettings();
  const [overlay, setOverlay] = useState<Overlay>(null);
  // `tz` is absent only for fallback places and pre-tz stored overrides;
  // the device zone is the only sensible reading of "local time" there.
  const timeZone = location.place.tz ?? deviceTimezone();
  const profile = useDayProfile(now, location.place.lat, location.place.lon, timeZone);
  // Keyed on the profile, so this rescans the samples only when they are
  // themselves recomputed — a new day in the place's zone, or a new place —
  // rather than on every tick of the second hand.
  const events = useMemo(() => sunEvents(profile.altitudes), [profile]);
  const close = () => setOverlay(null);

  return (
    <main className="app">
      {/*
        `display: contents` (see styles.css) keeps this wrapper invisible to
        layout — the flex children below still belong directly to `.app` —
        while giving the overlays something to make `inert` while one is open,
        so a keyboard or screen-reader user cannot reach the clock, the hint,
        the panel or the burger behind the scrim. The overlay itself renders as
        a sibling, outside the inert subtree.
      */}
      <div className="app-content" inert={overlay !== null}>
        <button
          type="button"
          className="burger"
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={overlay === 'menu'}
          onClick={() => setOverlay('menu')}
        >
          ☰
        </button>

        {/*
          The hint is positioned against the stage, not the panel, so that its
          arrival and dismissal never change the height the dial is sized from.
        */}
        <div className="clock-stage">
          <Clock
            now={now}
            profile={profile}
            timeZone={timeZone}
            // `null` rather than a flag, so the Clock never learns that a
            // setting exists — it draws the arc when it is given something to
            // draw it from.
            events={showSunArc ? events : null}
          />

          {location.hint && (
            <LocationHint
              source={location.hint}
              onUseLocation={location.useDeviceLocation}
              onOpenPicker={() => setOverlay('picker')}
              onDismiss={location.dismissHint}
            />
          )}
        </div>

        <LocationPanel
          place={location.place}
          error={location.error}
          hideSource={location.hint !== null}
          onOpenPicker={() => setOverlay('picker')}
        />
      </div>

      {overlay === 'menu' && (
        <MainMenu fullscreen={fullscreen} onOpenSettings={() => setOverlay('settings')} onClose={close} />
      )}

      {overlay === 'settings' && (
        <SettingsModal
          place={location.place}
          showSunArc={showSunArc}
          onShowSunArcChange={setShowSunArc}
          onOpenPicker={() => setOverlay('picker')}
          onClose={close}
        />
      )}

      {overlay === 'picker' && (
        <CityPickerModal
          canLocate={location.permission !== 'unsupported' && location.permission !== 'denied'}
          onChooseCity={location.chooseCity}
          onUseDeviceLocation={location.useDeviceLocation}
          onClose={close}
        />
      )}
    </main>
  );
}
