import { offsetsDiffer } from '../lib/cities';
import { deviceTimezone, type Place, utcOffsetLabel } from '../lib/location';

interface Props {
  place: Place;
  error: string | null;
  onOpenPicker: () => void;
  /**
   * The date the dial is shaded for, already formatted, when that is not today.
   * `null` the rest of the time, which is most of the time.
   */
  simulatedDate: string | null;
  onResetDate: () => void;
}

/**
 * How the place is described, in the reader's terms rather than the resolver's.
 * Each tier stays labelled honestly — a borrowed latitude must not be presented
 * with the confidence of a real zone match — but none of them argue with the
 * reader: the dial behind this line is already shaded for the place named in it,
 * and a dawn in visibly the wrong spot makes the case for changing it better
 * than any warning here could.
 */
const SOURCE_TEXT: Record<Place['source'], string> = {
  manual: 'from the city you picked',
  gps: 'from your device',
  timezone: 'from your timezone',
  offset: 'roughly, from your UTC offset',
  fallback: 'no location yet — pick a city',
};

/**
 * The footer under the clock: what the dial is showing, where that came from,
 * and the one link that changes it.
 *
 * This line is now the *whole* of the first-run experience. A floating note used
 * to appear over the dial's lower rim on a guessed place, offering geolocation
 * and a city picker; it covered the clock at the exact moment someone was
 * meeting it for the first time, to say something the reader had not yet asked.
 * Naming the place plainly says the same thing in the space that was already
 * reserved for saying it, and `change` leads to every way of correcting it.
 *
 * Deliberately holds nothing that appears or disappears after mount — the dial
 * takes whatever height this panel leaves over (see `.clock-stage`), so a line
 * arriving late resizes the clock. That is also why the source is stated
 * unconditionally now: it used to be suppressed while the floating note was up,
 * which made it a line that could arrive a tick after mount.
 *
 * It used to also print the day's sunrise and sunset, and to carry the theme
 * cycler. Both have gone: the face states both instants by where its shading
 * turns, without a line of text either way, and the theme belongs with the other
 * preferences rather than wedged into this line.
 *
 * The simulated-date notice is the one thing here that comes and goes, and it is
 * **absolutely positioned over the stage above** rather than placed in this
 * column, precisely because of the no-reflow rule: in the flow it would resize
 * the dial at the moment the reader started dragging it. It is rendered from here
 * anyway so it stays next to the place name it qualifies, in the DOM and on
 * screen.
 */
export function LocationPanel({ place, error, onOpenPicker, simulatedDate, onResetDate }: Props) {
  const zone = deviceTimezone();
  // Compares current UTC offsets, not IANA zone names — Oslo and Prague are
  // different zones that share an offset for much of the year, and there is
  // nothing to note when the dial reads the same either way.
  const tzMismatch = place.tz && offsetsDiffer(place.tz, zone);

  return (
    <section className="panel">
      {/*
        Floated over the stage, not in this column — see the note above. Only the
        button takes pointer events, so the rest cannot swallow a drag aimed at
        the dial behind it.
      */}
      {simulatedDate !== null && (
        <p className="sim-date">
          Shading for <strong>{simulatedDate}</strong>
          {' · '}
          <button type="button" className="link" onClick={onResetDate}>
            back to today
          </button>
        </p>
      )}

      <p className="place">
        Showing <strong>{place.label}</strong> · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}{' '}
        <span className="muted">({SOURCE_TEXT[place.source]})</span>{' '}
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
