import { offsetsDiffer } from '../lib/cities';
import { deviceTimezone, type Place, utcOffsetLabel } from '../lib/location';

interface Props {
  place: Place;
  error: string | null;
  /**
   * Set while the location hint is on screen. The hint already names the
   * provenance, and two lines a few pixels apart both saying "guessed from
   * your timezone" reads like a stutter.
   */
  hideSource: boolean;
  onOpenPicker: () => void;
}

const SOURCE_TEXT: Record<Place['source'], string> = {
  manual: 'chosen by you',
  gps: 'from your device',
  timezone: 'guessed from your timezone',
  offset: 'rough guess from your UTC offset — pick a city to be sure',
  fallback: 'unknown — pick a city below',
};

/**
 * The footer under the clock: where the dial's idea of "here" came from, and the
 * one link that changes it.
 *
 * Deliberately holds nothing that appears or disappears after mount — the dial
 * takes whatever height this panel leaves over (see `.clock-stage`), so a line
 * arriving late resizes the clock. The chooser lives in `CityPickerModal`, the
 * first-run nudge in `LocationHint` and everything configurable in
 * `SettingsModal`, all of them floating over the dial or replacing it, for that
 * reason.
 *
 * It used to also print the day's sunrise and sunset, and to carry the theme
 * cycler. Both have gone: the times are now the two ends of the daylight arc
 * outside the rim, which says the same thing without a line of text, and the
 * theme belongs with the other preferences rather than wedged into this line.
 */
export function LocationPanel({ place, error, hideSource, onOpenPicker }: Props) {
  const zone = deviceTimezone();
  // Compares current UTC offsets, not IANA zone names — Oslo and Prague are
  // different zones that share an offset for much of the year, and there is
  // nothing to note when the dial reads the same either way.
  const tzMismatch = place.tz && offsetsDiffer(place.tz, zone);

  return (
    <section className="panel">
      <p className="place">
        <strong>{place.label}</strong> · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}{' '}
        {!hideSource && <span className="muted">({SOURCE_TEXT[place.source]})</span>}{' '}
        <button type="button" className="link" onClick={onOpenPicker}>
          change
        </button>
      </p>

      {/*
        Persists after a city is chosen — the dial runs on the chosen place's
        clock, and while that clock disagrees with the device's the reader
        deserves a standing reminder of whose time they are looking at.
      */}
      {tzMismatch && (
        <p className="muted tz-note">
          showing {utcOffsetLabel(place.tz ?? zone)} time; your clock is {utcOffsetLabel(zone)}
        </p>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
