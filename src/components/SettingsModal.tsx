import type { RefObject } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { Place } from '../lib/location';
import type { ThemePreference } from '../lib/theme';
import { ModalSheet } from './ModalSheet';

interface Props {
  place: Place;
  showSunArc: boolean;
  /** Passed straight through — see `ModalSheet`'s own note on the prop. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onShowSunArcChange: (next: boolean) => void;
  onOpenPicker: () => void;
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
 * The native dropdown follows the theme only because `color-scheme` is declared
 * in all three theme blocks in styles.css. Remove it and the option list goes
 * white-on-white in dark mode.
 */
export function SettingsModal({
  place,
  showSunArc,
  restoreFocusRef,
  onShowSunArcChange,
  onOpenPicker,
  onClose,
}: Props) {
  const [preference, setPreference] = useTheme();

  return (
    <ModalSheet labelledBy="settings-title" onClose={onClose} restoreFocusRef={restoreFocusRef} dismissOnScrim>
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
            checked={showSunArc}
            aria-describedby="sun-arc-hint"
            onChange={(event) => onShowSunArcChange(event.currentTarget.checked)}
          />
          Show daylight arc
        </label>
        <p className="settings-hint" id="sun-arc-hint">
          A band outside the rim, from sunrise to sunset.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="settings-legend">Location</h3>
        <p className="settings-place">{place.label}</p>
        <button type="button" onClick={onOpenPicker}>
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
