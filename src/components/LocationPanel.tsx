import { offsetsDiffer } from '../lib/cities';
import { deviceTimezone, type Place, utcOffsetLabel } from '../lib/location';
import type { SunEvents } from '../lib/sun';
import { formatMinutesOfDay } from '../lib/time';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  place: Place;
  events: SunEvents;
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
 * The day's sunrise and sunset as one line. Both may be absent — inside polar
 * day and polar night neither crossing happens — and on the single days that
 * begin or end those, exactly one does, so each part is rendered independently
 * of the other.
 */
function sunTimes({ sunrise, sunset, polar }: SunEvents): string {
  if (polar === 'day') {
    return 'Daylight all day';
  }
  if (polar === 'night') {
    return 'Night all day';
  }

  return [
    sunrise !== null ? `Sunrise ${formatMinutesOfDay(sunrise)}` : null,
    sunset !== null ? `Sunset ${formatMinutesOfDay(sunset)}` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

/**
 * The footer under the clock. Deliberately holds nothing that appears or
 * disappears after mount — the dial takes whatever height this panel leaves
 * over (see `.clock-stage`), so a line arriving late resizes the clock. The
 * sun-times line below is therefore unconditional: `sunEvents` always returns
 * something renderable, polar cases included. The chooser lives in
 * `CityPickerModal` and the first-run nudge in `LocationHint`, both floating
 * over the dial, for the same reason.
 */
export function LocationPanel({ place, events, error, hideSource, onOpenPicker }: Props) {
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
        </button>{' '}
        · <ThemeToggle />
      </p>

      <p className="sun-times">{sunTimes(events)}</p>

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
