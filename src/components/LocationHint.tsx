import type { GuessedSource } from '../lib/location';

interface Props {
  source: GuessedSource;
  onUseLocation: () => void;
  onOpenPicker: () => void;
  onDismiss: () => void;
}

/**
 * What the reader is told about a guessed place. Deliberately just the
 * provenance: the sunrise and sunset times sit a few lines below in the panel,
 * and a concrete time you have been told is a guess argues for itself better
 * than any claim about how wrong it might be.
 */
const LEAD: Record<GuessedSource, string> = {
  timezone: 'Guessed from your timezone',
  offset: 'Guessed from your UTC offset',
  fallback: 'No location yet',
};

/**
 * The first-run nudge, replacing the modal that used to open over the dial
 * before the clock had shown anything at all. Not a dialog: nothing is inert
 * behind it, Escape does not close it, and it can be ignored indefinitely —
 * the clock is already running on the guess it describes.
 *
 * It floats over the dial's lower rim rather than joining the panel because
 * the panel's natural height is what the dial's size is computed from (see
 * `.clock-stage` in styles.css). Appearing there a tick after mount, and
 * vanishing again on dismissal, would resize the clock twice in the first few
 * seconds.
 */
export function LocationHint({ source, onUseLocation, onOpenPicker, onDismiss }: Props) {
  return (
    <aside className="hint" aria-label="Location accuracy">
      <p className="hint-lead">{LEAD[source]}</p>

      <div className="hint-actions">
        <button type="button" className="primary" onClick={onUseLocation}>
          Use my location
        </button>
        <button type="button" className="link" onClick={onOpenPicker}>
          Pick a city
        </button>
      </div>

      {/*
        Next to the button rather than in a dialog read before it: this is the
        objection someone has at the moment of deciding, so it belongs where
        the decision is made.
      */}
      <p className="hint-note">Rounded to about a kilometre, and it never leaves this device.</p>

      <button type="button" className="hint-dismiss" onClick={onDismiss} aria-label="Dismiss this note">
        ✕
      </button>
    </aside>
  );
}
