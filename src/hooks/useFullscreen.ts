import { useEffect, useState } from 'react';

export interface Fullscreen {
  /** Whether the browser will honour a fullscreen request at all. */
  supported: boolean;
  /** Whether the page is in fullscreen right now. */
  active: boolean;
  toggle: () => void;
}

/**
 * Fullscreen for the whole page, as one control.
 *
 * `supported` reads `document.fullscreenEnabled` rather than checking for the
 * `requestFullscreen` method or sniffing the user agent. That is the check that
 * correctly reports `false` on iPhone, where Safari implements the API for
 * `<video>` and nothing else — the method exists on elements, so a method check
 * would claim support and then fail silently. The menu hides the entry when this
 * is false, which is why getting it right matters more than it looks.
 *
 * `active` is tracked from the `fullscreenchange` event, not from our own calls:
 * Escape, F11 and the platform's own gestures all leave fullscreen without going
 * through `toggle`, and a control that then still says "Full screen" is lying.
 *
 * Deliberately **not persisted.** Entering fullscreen requires a user gesture, so
 * a stored preference could never be honoured on load — it would be a setting
 * that silently fails every reload. Do not add it.
 */
export function useFullscreen(): Fullscreen {
  const [active, setActive] = useState(false);
  // Read once on mount rather than during render: `document` is available in
  // this app (there is no SSR), but the value cannot change for the life of the
  // page, so there is nothing to recompute.
  const [supported] = useState(() => typeof document !== 'undefined' && document.fullscreenEnabled === true);

  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = () => {
    // Both calls reject rather than throw when the gesture requirement is not
    // met or the platform refuses; there is nothing useful to say about it, and
    // an unhandled rejection in a click handler is worse than a no-op.
    if (document.fullscreenElement === null) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  };

  return { supported, active, toggle };
}
