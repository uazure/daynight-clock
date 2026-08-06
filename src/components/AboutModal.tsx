import type { RefObject } from 'react';
import { BUILD, commitUrl, formatBuildDate, shortCommit } from '../lib/build';
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
  const url = commitUrl(BUILD.commit);

  return (
    <ModalSheet labelledBy="about-title" title="What is this?" onClose={onClose} restoreFocusRef={restoreFocusRef}>
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

      {/*
        Which build this is, for a bug report. Last and quiet: nobody opens this
        sheet for it, and the four sentences above are what the sheet is for.

        The hash links to the commit — the app's only outbound link, and still no
        runtime *network call*, so the "no server, no analytics" non-goals hold.
        A build with no git behind it links to nothing rather than to a 404.
      */}
      <p className="sheet-note build-info">
        Version {BUILD.version}
        {BUILD.commit !== '' && (
          <>
            {' · '}
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {shortCommit(BUILD.commit)}
              </a>
            ) : (
              shortCommit(BUILD.commit)
            )}
          </>
        )}
        {formatBuildDate(BUILD.date) !== '' && <> · built {formatBuildDate(BUILD.date)}</>}
      </p>
    </ModalSheet>
  );
}
