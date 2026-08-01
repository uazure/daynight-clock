import { useTheme } from '../hooks/useTheme';
import type { Place } from '../lib/location';
import type { ThemePreference } from '../lib/theme';
import { ModalSheet } from './ModalSheet';

interface Props {
  place: Place;
  showSunArc: boolean;
  onShowSunArcChange: (next: boolean) => void;
  onOpenPicker: () => void;
  onClose: () => void;
}

/**
 * Everything the reader can change, in one sheet.
 *
 * The theme is a radio group here, not the three-way cycle it used to be on the
 * panel. Cycling earned its place while the control had to fit inline on the only
 * strip of chrome the app had; in a sheet there is room to show all three states
 * at once, and "auto" in particular is worth naming rather than discovering by
 * clicking past it.
 */
const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; hint?: string }> = [
  { value: 'auto', label: 'Automatic', hint: 'Follows your device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsModal({ place, showSunArc, onShowSunArcChange, onOpenPicker, onClose }: Props) {
  const [preference, setPreference] = useTheme();

  return (
    <ModalSheet labelledBy="settings-title" onClose={onClose} dismissOnScrim>
      <h2 id="settings-title">Settings</h2>

      <fieldset className="settings-section">
        <legend>Theme</legend>
        {THEME_OPTIONS.map(({ value, label, hint }) => (
          <div key={value}>
            <label className="settings-row">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={preference === value}
                onChange={() => setPreference(value)}
              />
              {label}
            </label>
            {hint && <p className="settings-hint">{hint}</p>}
          </div>
        ))}
      </fieldset>

      <fieldset className="settings-section">
        <legend>Dial</legend>
        <label className="settings-row">
          <input
            type="checkbox"
            checked={showSunArc}
            onChange={(event) => onShowSunArcChange(event.currentTarget.checked)}
          />
          Show daylight arc
        </label>
        <p className="settings-hint">A band outside the rim, from sunrise to sunset.</p>
      </fieldset>

      <fieldset className="settings-section">
        <legend>Location</legend>
        <p className="settings-place">{place.label}</p>
        <button type="button" onClick={onOpenPicker}>
          Change location…
        </button>
      </fieldset>

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalSheet>
  );
}
