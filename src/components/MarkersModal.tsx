import { type RefObject, useState } from 'react';
import { MAX_LABEL_LENGTH, MAX_MARKERS, type Marker, parseMarkers } from '../lib/markers';
import { formatMinutesOfDay, minutesFromTimeValue } from '../lib/time';
import { ModalSheet } from './ModalSheet';

interface Props {
  markers: Marker[];
  /** Passed straight through — see `ModalSheet`'s own note on the prop. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onChange: (next: Marker[]) => void;
  onClose: () => void;
}

/**
 * A row as it is being typed, which is not yet a `Marker`: the two times are the
 * strings an `<input type="time">` holds, and either may be empty or half-typed.
 * `key` exists only so React can tell the rows apart across an insertion or a
 * removal — it is never stored, so it cannot collide with a key from a previous
 * session the way a persisted id could.
 */
interface Draft {
  key: number;
  label: string;
  start: string;
  end: string;
}

const toDrafts = (markers: Marker[]): Draft[] =>
  markers.map((marker, index) => ({
    key: index,
    label: marker.label,
    start: formatMinutesOfDay(marker.start),
    end: marker.end === null ? '' : formatMinutesOfDay(marker.end),
  }));

/**
 * Drafts back to markers, dropping whatever is not finished yet.
 *
 * `parseMarkers` does the dropping: a row with no usable start time yields no
 * marker, so a half-typed row simply is not on the dial until it makes sense.
 * That is what lets this commit on every keystroke — the dial updates live and
 * there is no save button, no validation state and no error message.
 */
const toMarkers = (drafts: Draft[]): Marker[] =>
  parseMarkers(
    drafts.map((draft) => ({
      label: draft.label,
      start: minutesFromTimeValue(draft.start),
      end: minutesFromTimeValue(draft.end),
    })),
  );

/**
 * The marker editor: up to five rows of name, start and (optionally) end.
 *
 * **An empty end is the whole moment/interval choice.** Leave it blank and the
 * marker is a moment — an alarm, a single radial dash on the dial; fill it in and
 * the same row becomes an interval that sweeps between the two. That is one
 * control fewer than a kind selector, and the shape of the row says which it is.
 *
 * **No `disabled` control lives in here, deliberately.** At five markers the
 * *Add* button is removed rather than disabled: a disabled button matches
 * `ModalSheet`'s `FOCUSABLE_SELECTOR` without being a tab stop, which is exactly
 * how the focus trap leaked when the theme was a radio group (AGENTS.md rule 9).
 * For the same reason *Close* stays last in the DOM, so a `<input type="time">`
 * — whose internal segments browsers disagree about tabbing between — is never
 * the trap's first or last element.
 *
 * Its own sheet rather than a fourth section of the settings sheet: five rows of
 * three controls is a form, and it would have buried the two single choices above
 * it.
 */
export function MarkersModal({ markers, restoreFocusRef, onChange, onClose }: Props) {
  // Seeded from the stored markers once. The sheet exists for one editing
  // session, so the drafts do too, and the dial is updated through `onChange`
  // rather than by reading this state from outside.
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(markers));
  const [nextKey, setNextKey] = useState(markers.length);

  const commit = (next: Draft[]) => {
    setDrafts(next);
    onChange(toMarkers(next));
  };

  const edit = (key: number, field: 'label' | 'start' | 'end', value: string) =>
    commit(drafts.map((draft) => (draft.key === key ? { ...draft, [field]: value } : draft)));

  const add = () => {
    commit([...drafts, { key: nextKey, label: '', start: '', end: '' }]);
    setNextKey(nextKey + 1);
  };

  return (
    <ModalSheet labelledBy="markers-title" onClose={onClose} restoreFocusRef={restoreFocusRef} dismissOnScrim>
      <h2 id="markers-title">Your times</h2>

      <p className="settings-hint markers-lead">
        Up to {MAX_MARKERS}. Leave the second time empty for a single moment rather than a stretch of the day; a stretch
        may run past midnight.
      </p>

      {drafts.length > 0 && (
        <ul className="marker-rows">
          {drafts.map((draft, index) => (
            <li className="marker-row" key={draft.key}>
              <input
                type="text"
                className="marker-label"
                value={draft.label}
                // The cap is what keeps the readout's first line inside the box
                // it is drawn in — see `MAX_LABEL_LENGTH`.
                maxLength={MAX_LABEL_LENGTH}
                placeholder="Name"
                aria-label={`Name of time ${index + 1}`}
                onChange={(event) => edit(draft.key, 'label', event.currentTarget.value)}
              />
              <div className="marker-times">
                <input
                  type="time"
                  value={draft.start}
                  aria-label={`Start of time ${index + 1}`}
                  onChange={(event) => edit(draft.key, 'start', event.currentTarget.value)}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  value={draft.end}
                  aria-label={`End of time ${index + 1}`}
                  onChange={(event) => edit(draft.key, 'end', event.currentTarget.value)}
                />
                <button
                  type="button"
                  className="link marker-remove"
                  onClick={() => commit(drafts.filter((other) => other.key !== draft.key))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {drafts.length < MAX_MARKERS ? (
        <button type="button" onClick={add}>
          Add a time
        </button>
      ) : (
        <p className="settings-hint">That is all {MAX_MARKERS}. Remove one to add another.</p>
      )}

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalSheet>
  );
}
