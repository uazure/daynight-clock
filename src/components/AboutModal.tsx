import type { RefObject } from 'react';
import { ModalSheet } from './ModalSheet';

interface Props {
  /** Passed straight through — see `ModalSheet`'s own note on the prop. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * What the clock is, for someone who has just met it.
 *
 * Four sentences, no jargon and no numbers: a 24-hour dial is unfamiliar enough
 * that the first question is "why is the hand pointing at 17 when it is five in
 * the afternoon", and the answer is the whole idea. Everything else this app
 * knows — the altitude sampling, the twilight window, the resolver chain — is
 * documented in the code and the README for people who go looking, and would
 * only bury the answer here.
 *
 * Reached from the menu rather than shown on first run. The dial explains itself
 * to most readers, and the one thing the old first-run note proved is that
 * covering the clock to talk about it is the wrong trade.
 */
export function AboutModal({ restoreFocusRef, onClose }: Props) {
  return (
    <ModalSheet labelledBy="about-title" onClose={onClose} restoreFocusRef={restoreFocusRef} dismissOnScrim>
      <h2 id="about-title">What is this?</h2>

      <p>
        This is a clock with a 24-hour face: the hour hand goes round once a day instead of twice, so every hour of the
        day has its own place on the dial.
      </p>
      <p>Noon sits at the top and midnight at the bottom, which means the hand points up while the sun is up.</p>
      <p>
        The face is shaded with the real daylight at your location — bright through the day, dark through the night, and
        fading between the two at dawn and dusk.
      </p>
      <p>
        So a glance shows you the whole day at once: how much daylight is left, and how far through the night you are.
      </p>

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalSheet>
  );
}
