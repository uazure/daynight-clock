import { type MouseEvent, useMemo, useRef, useState } from 'react';
import { AboutModal } from './components/AboutModal';
import { CityPickerModal } from './components/CityPickerModal';
import { Clock } from './components/Clock';
import { LocationPanel } from './components/LocationPanel';
import { MainMenu } from './components/MainMenu';
import { SettingsModal } from './components/SettingsModal';
import { useDayProfile } from './hooks/useDayProfile';
import { useFullscreen } from './hooks/useFullscreen';
import { useLocation } from './hooks/useLocation';
import { useNow } from './hooks/useNow';
import { useSettings } from './hooks/useSettings';
import { deviceTimezone, isGuessed } from './lib/location';
import { sunEvents } from './lib/sun';

/**
 * Which overlay is up, as one value rather than a boolean each.
 *
 * Three booleans would make "menu and settings both open" representable, and
 * the two would stack scrims and focus traps. One value cannot: opening any
 * overlay closes whatever was there, so the menu handing off to the settings
 * sheet is a replace, and so is the settings sheet handing off to the picker.
 */
type Overlay = null | 'menu' | 'settings' | 'picker' | 'about';

export default function App() {
  const location = useLocation();
  const now = useNow();
  const fullscreen = useFullscreen();
  const [showSunArc, setShowSunArc] = useSettings();
  const [overlay, setOverlay] = useState<Overlay>(null);
  /**
   * Where the picker goes when it closes: back to the settings sheet if that is
   * what opened it, and away entirely if the footer's `change` link did.
   *
   * Closing a dialog has to undo the *one* opening it belongs to. Every sheet
   * closing to `null` meant Close on the picker also took the settings sheet
   * with it, which reads as the app dismissing a whole conversation because you
   * finished a sentence. This is a return target, not a second open overlay —
   * the one-value invariant above still holds, and only the picker has anywhere
   * to return to, since it is the only sheet another sheet opens.
   */
  const [pickerReturnsTo, setPickerReturnsTo] = useState<Extract<Overlay, 'settings'> | null>(null);
  // `tz` is absent only for fallback places and pre-tz stored overrides;
  // the device zone is the only sensible reading of "local time" there.
  const timeZone = location.place.tz ?? deviceTimezone();
  const profile = useDayProfile(now, location.place.lat, location.place.lon, timeZone);
  // Keyed on the profile, so this rescans the samples only when they are
  // themselves recomputed — a new day in the place's zone, or a new place —
  // rather than on every tick of the second hand.
  const events = useMemo(() => sunEvents(profile.altitudes), [profile]);
  /**
   * The control that started the current run of overlays, and where focus goes
   * when the last of them closes.
   *
   * Needed because the sheets replace one another: each one's own idea of "what
   * was focused when I opened" is a control inside the sheet it replaced, which is
   * detached by the time the chain ends, and focusing a detached node silently
   * does nothing — so burger → Settings → Change location → Close used to leave
   * focus on `<body>`. Only the *entry points* set this; the handoffs between
   * sheets deliberately leave it pointing at the origin.
   */
  const overlayOrigin = useRef<HTMLElement | null>(null);
  const openFrom = (next: Exclude<Overlay, null>) => (event: MouseEvent<HTMLElement>) => {
    overlayOrigin.current = event.currentTarget;
    setOverlay(next);
  };
  /**
   * The picker opened straight from the footer's `change` link, where no chain
   * forms: one sheet, so its own capture of the link that opened it is both
   * correct and still attached when it closes. The anchor is *cleared* rather
   * than left alone because it would otherwise still hold the burger from an
   * earlier run and send focus there instead of back to the link the reader
   * actually used.
   */
  const openPicker = () => {
    overlayOrigin.current = null;
    setPickerReturnsTo(null);
    setOverlay('picker');
  };
  const close = () => {
    setOverlay(null);
    setPickerReturnsTo(null);
  };
  /**
   * Deliberately leaves `pickerReturnsTo` alone: `SettingsModal` reads it in the
   * same render to know it is being shown again rather than opened afresh, and
   * `close` clears it when the chain actually ends.
   */
  const closePicker = () => (pickerReturnsTo === null ? close() : setOverlay(pickerReturnsTo));

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
          // `dialog`, not `menu`: what opens is a `role="dialog"` sheet, and
          // `aria-haspopup` has to name the popup's actual role. Claiming `menu`
          // also promises `role="menuitem"` children with arrow-key roving focus,
          // which a two-item sheet does not have and does not need.
          aria-haspopup="dialog"
          aria-expanded={overlay === 'menu'}
          onClick={openFrom('menu')}
        >
          ☰
        </button>

        {/*
          Nothing but the dial lives in here. A first-run note used to float over
          its lower rim, which put the app's one explanation on top of the one
          thing it was explaining; the panel below now carries what it said.
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
        </div>

        <LocationPanel place={location.place} error={location.error} onOpenPicker={openPicker} />
      </div>

      {/*
        Each sheet gets the same anchor, so however deep the chain went, closing
        the last one lands focus back on the control that started it. The handoffs
        below stay plain `setOverlay` calls precisely so they do not move it.
      */}
      {overlay === 'menu' && (
        <MainMenu
          fullscreen={fullscreen}
          restoreFocusRef={overlayOrigin}
          onOpenSettings={() => setOverlay('settings')}
          onOpenAbout={() => setOverlay('about')}
          onClose={close}
        />
      )}

      {overlay === 'about' && <AboutModal restoreFocusRef={overlayOrigin} onClose={close} />}

      {overlay === 'settings' && (
        <SettingsModal
          place={location.place}
          showSunArc={showSunArc}
          // Set only while this sheet is the picker's return target, which is
          // true exactly when the picker has just closed back into it.
          returningFromPicker={pickerReturnsTo === 'settings'}
          restoreFocusRef={overlayOrigin}
          onShowSunArcChange={setShowSunArc}
          onOpenPicker={() => {
            setPickerReturnsTo('settings');
            setOverlay('picker');
          }}
          onClose={close}
        />
      )}

      {overlay === 'picker' && (
        <CityPickerModal
          canLocate={location.permission !== 'unsupported' && location.permission !== 'denied'}
          // A place that is already a guess is what resetting would produce, so
          // the reset is offered only where it has something to undo.
          canReset={!isGuessed(location.place.source)}
          restoreFocusRef={overlayOrigin}
          onChooseCity={location.chooseCity}
          onUseDeviceLocation={location.useDeviceLocation}
          onUseTimezone={location.useTimezoneLocation}
          onClose={closePicker}
        />
      )}
    </main>
  );
}
