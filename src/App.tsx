import { type MouseEvent, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { AboutModal } from './components/AboutModal';
import { CityPickerModal } from './components/CityPickerModal';
import { Clock } from './components/Clock';
import { LocationPanel } from './components/LocationPanel';
import { MainMenu } from './components/MainMenu';
import { MarkersModal } from './components/MarkersModal';
import { SettingsModal } from './components/SettingsModal';
import { YearSlider } from './components/YearSlider';
import { useDayProfile } from './hooks/useDayProfile';
import { useFullscreen } from './hooks/useFullscreen';
import { useHour12 } from './hooks/useHour12';
import { useLocation } from './hooks/useLocation';
import { useMarkers } from './hooks/useMarkers';
import { useNow } from './hooks/useNow';
import { useShowDigitalTime } from './hooks/useShowDigitalTime';
import { useShowMarkers } from './hooks/useShowMarkers';
import { useYearDrag } from './hooks/useYearDrag';
import { useYearKnob } from './hooks/useYearKnob';
import { deviceTimezone, isGuessed } from './lib/location';
import { sunEvents } from './lib/sun';
import { dateKeyInZone } from './lib/time';
import {
  clampDayOfYear,
  dateKeyForDayOfYear,
  dayOfYearForDateKey,
  daysInYear,
  formatDayOfYear,
  yearOfDateKey,
} from './lib/year';

/**
 * Which overlay is up, as one value rather than a boolean each.
 *
 * Three booleans would make "menu and settings both open" representable, and
 * the two would stack scrims and focus traps. One value cannot: opening any
 * overlay closes whatever was there, so the menu handing off to the settings
 * sheet is a replace, and so is the settings sheet handing off to the picker.
 */
type Overlay = null | 'menu' | 'settings' | 'picker' | 'about' | 'markers';

/**
 * What the dial gets when the markers are switched off. A module constant, not
 * an inline `[]`, so the reference is stable across renders and `Clock`'s
 * `memo`ised children stay memoised while hidden.
 */
const NO_MARKERS: never[] = [];

/** The sheets the settings sheet can open, and return from. */
type SettingsChild = Extract<Overlay, 'picker' | 'markers'>;

export default function App() {
  const location = useLocation();
  const now = useNow();
  const fullscreen = useFullscreen();
  const [markers, setMarkers] = useMarkers();
  const [showMarkers, setShowMarkers] = useShowMarkers();
  const [showYearKnob, setShowYearKnob] = useYearKnob();
  const [showDigitalTime, setShowDigitalTime] = useShowDigitalTime();
  const [hour12, setHour12] = useHour12();
  const [overlay, setOverlay] = useState<Overlay>(null);
  /**
   * Which sheet the settings sheet opened, if it opened one — and by implication
   * where that sheet goes when it closes: back to the settings sheet, rather than
   * away entirely.
   *
   * Closing a dialog has to undo the *one* opening it belongs to. Every sheet
   * closing to `null` meant Close on the picker also took the settings sheet
   * with it, which reads as the app dismissing a whole conversation because you
   * finished a sentence. This is a return target, not a second open overlay —
   * the one-value invariant above still holds.
   *
   * It also survives the child closing, so `SettingsModal` can land focus on
   * whichever of its buttons opened that child rather than at the top of a dialog
   * the reader was in the middle of. `close` is what finally clears it.
   */
  const [settingsChild, setSettingsChild] = useState<SettingsChild | null>(null);
  // `tz` is absent only for fallback places and pre-tz stored overrides;
  // the device zone is the only sensible reading of "local time" there.
  const timeZone = location.place.tz ?? deviceTimezone();

  /**
   * Which day the dial is shaded for, or `null` for "whatever today is".
   *
   * `null` rather than today's number so an untouched dial still rolls over at
   * the place's own midnight, and so "back to today" is a state to return to
   * rather than a number to recompute. Deliberately not persisted: reopening the
   * app days later to a simulated date, with no memory of having set one, is a
   * worse failure than losing a scrub position on reload.
   */
  const [simulatedDay, setSimulatedDay] = useState<number | null>(null);
  /**
   * Switching the knob off returns the dial to today. Read here rather than reset
   * in the settings handler, so the invariant holds however the setting changes —
   * including the first render after a reload with the key absent.
   */
  const activeDay = showYearKnob ? simulatedDay : null;

  const todayKey = dateKeyInZone(now, timeZone);
  const year = yearOfDateKey(todayKey);
  const daysThisYear = daysInYear(year);
  // Clamped on the way out rather than on the way in, so a 366 held over from a
  // leap year survives midnight on 31 December instead of throwing off the knob.
  const shownDay = activeDay === null ? dayOfYearForDateKey(todayKey) : clampDayOfYear(activeDay, daysThisYear);
  const shadingKey = activeDay === null ? todayKey : dateKeyForDayOfYear(year, shownDay);

  /**
   * The knob follows the finger on the urgent value; the 1440-sample profile is
   * computed from a deferred one. React abandons and restarts a deferred render
   * when a newer value arrives, so a fast scrub across months **skips** the days
   * it passes rather than computing every one of them. `startTransition` would
   * serialise them instead, and putting the knob itself behind the deferral would
   * make it lag the finger, which is the one thing a drag cannot do.
   */
  const profile = useDayProfile(useDeferredValue(shadingKey), location.place.lat, location.place.lon, timeZone);
  // Keyed on the profile, so this rescans the samples only when they are
  // themselves recomputed — a new day in the place's zone, or a new place —
  // rather than on every tick of the second hand.
  const events = useMemo(() => sunEvents(profile.altitudes), [profile]);

  /**
   * Whether the knob should show a focus ring. Driven from the hidden slider's
   * own `:focus-visible`, so a mouse drag leaves it off and a Tab turns it on.
   */
  const [knobFocusVisible, setKnobFocusVisible] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  /**
   * Hand focus to the slider when a drag ends, not when it starts.
   *
   * A focused native range announces every value change, and a drag produces
   * hundreds — so focusing on `pointerup` yields exactly one announcement, of the
   * date actually chosen, and leaves the arrows available to fine-tune from
   * there. `preventScroll` because the control is 1px and off-screen.
   */
  const focusSlider = useCallback(() => {
    sliderRef.current?.focus({ preventScroll: true });
  }, []);

  const { dragging, handlers } = useYearDrag(shownDay, daysThisYear, setSimulatedDay, focusSlider);
  const simulatedDate = activeDay === null ? null : formatDayOfYear(year, shownDay);
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
    setSettingsChild(null);
    setOverlay('picker');
  };
  const close = () => {
    setOverlay(null);
    setSettingsChild(null);
  };
  /** Opened from the settings sheet, so this is a handoff, not an entry point:
   *  `overlayOrigin` is left pointing at whatever started the chain. */
  const openFromSettings = (child: SettingsChild) => () => {
    setSettingsChild(child);
    setOverlay(child);
  };
  /**
   * Deliberately leaves `settingsChild` alone: `SettingsModal` reads it in the
   * same render to know it is being shown again rather than opened afresh, and
   * `close` clears it when the chain actually ends.
   */
  const closeChild = () => (settingsChild === null ? close() : setOverlay('settings'));

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
          {/*
            Before the dial in the DOM, so tab order reads burger → date → the
            footer's `change` link, and so the focus-ring rule in styles.css can
            reach forward into `.clock` from it.
          */}
          {showYearKnob && (
            <YearSlider
              ref={sliderRef}
              year={year}
              dayOfYear={shownDay}
              total={daysThisYear}
              onChange={setSimulatedDay}
              onFocusVisibleChange={setKnobFocusVisible}
            />
          )}
          <Clock
            now={now}
            profile={profile}
            timeZone={timeZone}
            events={events}
            // Hidden is a drawing decision, not a data one: the stored list is
            // untouched, the markers sheet still edits it, and switching back
            // on shows exactly what was there.
            markers={showMarkers ? markers : NO_MARKERS}
            hour12={hour12}
            showDigitalTime={showDigitalTime}
            knobDay={showYearKnob ? { dayOfYear: shownDay, daysThisYear } : null}
            simulatedDate={simulatedDate}
            knobFocusVisible={knobFocusVisible}
            knobDragging={dragging}
            knobHandlers={handlers}
          />
        </div>

        <LocationPanel
          place={location.place}
          error={location.error}
          onOpenPicker={openPicker}
          simulatedDate={simulatedDate}
          onResetDate={() => setSimulatedDay(null)}
        />
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
          showYearKnob={showYearKnob}
          showMarkers={showMarkers}
          markerCount={markers.length}
          showDigitalTime={showDigitalTime}
          hour12={hour12}
          // Set only while one of this sheet's own children is open or has just
          // closed back into it, which is what makes it a focus target.
          returningFrom={settingsChild}
          restoreFocusRef={overlayOrigin}
          onShowYearKnobChange={setShowYearKnob}
          onShowMarkersChange={setShowMarkers}
          onShowDigitalTimeChange={setShowDigitalTime}
          onHour12Change={setHour12}
          onOpenPicker={openFromSettings('picker')}
          onOpenMarkers={openFromSettings('markers')}
          onClose={close}
        />
      )}

      {overlay === 'markers' && (
        <MarkersModal markers={markers} restoreFocusRef={overlayOrigin} onChange={setMarkers} onClose={closeChild} />
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
          onClose={closeChild}
        />
      )}
    </main>
  );
}
