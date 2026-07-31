import { offsetsDiffer } from '../lib/cities'
import { deviceTimezone, utcOffsetLabel, type Place } from '../lib/location'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  place: Place
  error: string | null
  onOpenPicker: () => void
}

const SOURCE_TEXT: Record<Place['source'], string> = {
  manual: 'chosen by you',
  gps: 'from your device',
  timezone: 'guessed from your timezone',
  offset: 'rough guess from your UTC offset — pick a city to be sure',
  fallback: 'unknown — pick a city below',
}

/**
 * The one-line footer under the clock. Deliberately holds nothing that grows
 * or shrinks after mount — the chooser lives in `CityPickerModal`, over the
 * clock, precisely so this panel's height (and therefore the dial's size)
 * never changes.
 */
export function LocationPanel({ place, error, onOpenPicker }: Props) {
  const zone = deviceTimezone()
  // Compares current UTC offsets, not IANA zone names — Oslo and Prague are
  // different zones that share an offset for much of the year, and there is
  // nothing to note when the dial reads the same either way.
  const tzMismatch = place.tz && offsetsDiffer(place.tz, zone)

  return (
    <section className="panel">
      <p className="place">
        <strong>{place.label}</strong> · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}{' '}
        <span className="muted">({SOURCE_TEXT[place.source]})</span>{' '}
        <button type="button" className="link" onClick={onOpenPicker}>
          change
        </button>{' '}
        · <ThemeToggle />
      </p>

      {/*
        Persists after a city is chosen — the dial runs on the chosen place's
        clock, and while that clock disagrees with the device's the reader
        deserves a standing reminder of whose time they are looking at.
      */}
      {tzMismatch && (
        <p className="muted tz-note">
          showing {utcOffsetLabel(place.tz ?? zone)} time; your clock is{' '}
          {utcOffsetLabel(zone)}
        </p>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  )
}
