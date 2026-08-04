import { type RefObject, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { Place } from '../lib/location';
import { MAX_MARKERS } from '../lib/markers';
import type { ThemePreference } from '../lib/theme';
import { ModalSheet } from './ModalSheet';

interface Props {
  place: Place;
  showYearKnob: boolean;
  /** Whether the markers are drawn on the dial; the list itself is untouched by it. */
  showMarkers: boolean;
  /** How many markers exist, so the row can say so without holding the list. */
  markerCount: number;
  /**
   * Which of this sheet's own dialogs it opened, when this sheet is on screen
   * again because that dialog has just closed rather than because it was opened
   * from the menu. Focus then lands on the button that opened it instead of on
   * the first control in the sheet: the sheet is remounted either way, so without
   * this the reader is returned to the top of a dialog they were in the middle of.
   */
  returningFrom?: 'picker' | 'markers' | null;
  onShowYearKnobChange: (next: boolean) => void;
  onShowMarkersChange: (next: boolean) => void;
  /** Passed straight through — see `ModalSheet`'s own note on the prop. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onOpenPicker: () => void;
  onOpenMarkers: () => void;
  onClose: () => void;
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'auto', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Everything the reader can change, in one sheet.
 *
 * The theme is a `<select>`. It has now been all three things — a link-styled
 * cycle inline on the panel, a radio group, and this — so the reasoning is worth
 * keeping:
 *
 * - The **cycle** was right while the control had to fit inline on the only strip
 *   of chrome the app had, and wrong the moment there was a sheet to put it in:
 *   you had to click past a state to learn it existed.
 * - The **radio group** showed all three at once, and broke the dialog's focus
 *   trap. A group is *one* tab stop but three matches of `ModalSheet`'s focusable
 *   selector, so the trap's first/last reasoning stopped being true and Shift-Tab
 *   from a checked radio other than the first escaped the sheet into the browser
 *   chrome. Reproduced at Light and Dark; Automatic happened to be safe only
 *   because it was the first match.
 * - A **select** is one tab stop and one match, which puts that trap back on
 *   solid ground, and it is the native control for one exclusive choice among a
 *   few. It costs one interaction to see the options, which is the trade.
 *
 * Getting the native dropdown to follow the theme takes both `color-scheme` in
 * all three theme blocks in styles.css *and* the explicit background the
 * `.settings-select` rule there sets on the closed control and its options; the
 * note on that rule has the failure each one prevents.
 */
export function SettingsModal({
  place,
  showYearKnob,
  showMarkers,
  markerCount,
  returningFrom,
  restoreFocusRef,
  onShowYearKnobChange,
  onShowMarkersChange,
  onOpenPicker,
  onOpenMarkers,
  onClose,
}: Props) {
  const [preference, setPreference] = useTheme();
  const changeLocationRef = useRef<HTMLButtonElement>(null);
  const markersRef = useRef<HTMLButtonElement>(null);
  const opener = { picker: changeLocationRef, markers: markersRef };

  return (
    <ModalSheet
      labelledBy="settings-title"
      onClose={onClose}
      // Only on the way back from one of the two sheets this one opens;
      // otherwise the sheet's own default (its first focusable, the theme
      // select) is the right landing place.
      initialFocusRef={returningFrom ? opener[returningFrom] : undefined}
      restoreFocusRef={restoreFocusRef}
      dismissOnScrim
    >
      <h2 id="settings-title">Settings</h2>

      <div className="settings-section">
        <label className="settings-legend" htmlFor="theme-select">
          Theme
        </label>
        {/*
          The wrapper exists only to hang the chevron on: `<select>` cannot carry
          a usable `::after` in most browsers, and the native arrow it replaces
          sits hard against the text with no way to space it.
        */}
        <div className="settings-select-wrap">
          <select
            id="theme-select"
            className="settings-select"
            value={preference}
            aria-describedby="theme-hint"
            // Cast rather than a guard: the options below are exactly the union, so
            // the only strings this element can yield are members of it.
            onChange={(event) => setPreference(event.currentTarget.value as ThemePreference)}
          >
            {THEME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p className="settings-hint" id="theme-hint">
          Automatic follows your device.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="settings-legend">Dial</h3>
        <label className="settings-row">
          <input
            type="checkbox"
            checked={showYearKnob}
            aria-describedby="year-knob-hint"
            onChange={(event) => onShowYearKnobChange(event.currentTarget.checked)}
          />
          Show the year knob
        </label>
        <p className="settings-hint" id="year-knob-hint">
          A pointer on the dial's edge marking today in the year. Drag it, and the face is shaded for that date instead
          — the hands keep the real time. Off returns the dial to today.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="settings-legend">Your times</h3>
        {/*
          The count is the state of this row: "none yet" is the off state, so
          there is no switch beside it to be inconsistent with.
        */}
        <p className="settings-place">
          {markerCount === 0 ? 'None yet' : `${markerCount} of ${MAX_MARKERS} on the dial`}
        </p>
        <button ref={markersRef} type="button" aria-describedby="markers-hint" onClick={onOpenMarkers}>
          {markerCount === 0 ? 'Add your times…' : 'Edit your times…'}
        </button>
        <p className="settings-hint" id="markers-hint">
          Your own moments and stretches of the day — a wake-up, the end of work — shaded onto the face, with a
          countdown to the next one at the centre.
        </p>
        <label className="settings-row">
          <input
            type="checkbox"
            checked={showMarkers}
            aria-describedby="show-markers-hint"
            onChange={(event) => onShowMarkersChange(event.currentTarget.checked)}
          />
          Show on the dial
        </label>
        <p className="settings-hint" id="show-markers-hint">
          Off hides them and the countdown without deleting anything; your times are kept and come back as they were.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="settings-legend">Location</h3>
        <p className="settings-place">{place.label}</p>
        <button ref={changeLocationRef} type="button" onClick={onOpenPicker}>
          Change location…
        </button>
      </div>

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalSheet>
  );
}
