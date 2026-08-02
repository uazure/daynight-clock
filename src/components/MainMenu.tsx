import type { RefObject } from 'react';
import type { Fullscreen } from '../hooks/useFullscreen';
import { ModalSheet } from './ModalSheet';

interface Props {
  fullscreen: Fullscreen;
  /** Passed straight through — see `ModalSheet`'s own note on the prop. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onClose: () => void;
}

/**
 * The burger menu: two rows, anchored top-left under the button that opened it.
 *
 * Fullscreen acts immediately from here rather than living in the settings sheet.
 * It is not a preference — it cannot be persisted, since entering fullscreen
 * needs a user gesture — so putting it among things that are remembered would
 * misdescribe it. The entry disappears entirely where the platform will not
 * honour it (iPhone, where Safari implements fullscreen for `<video>` only),
 * which leaves a one-item menu there rather than a control that does nothing.
 */
export function MainMenu({ fullscreen, restoreFocusRef, onOpenSettings, onOpenAbout, onClose }: Props) {
  return (
    <ModalSheet
      labelledBy="menu-title"
      onClose={onClose}
      restoreFocusRef={restoreFocusRef}
      placement="anchor-start"
      sheetClassName="sheet-menu"
      dismissOnScrim
    >
      <h2 id="menu-title">Menu</h2>

      <div className="menu-items">
        <button type="button" onClick={onOpenSettings}>
          Settings…
        </button>

        {fullscreen.supported && (
          <button
            type="button"
            onClick={() => {
              fullscreen.toggle();
              // Close with it: the point of fullscreen is to see the dial, and
              // leaving a scrim over it would defeat the whole gesture.
              onClose();
            }}
          >
            {fullscreen.active ? 'Exit full screen' : 'Full screen'}
          </button>
        )}

        {/*
          Last, and phrased as the question rather than as "About": someone who
          needs it is asking exactly this, and someone who does not can see at a
          glance that the row is not for them.
        */}
        <button type="button" onClick={onOpenAbout}>
          What is this?
        </button>
      </div>
    </ModalSheet>
  );
}
