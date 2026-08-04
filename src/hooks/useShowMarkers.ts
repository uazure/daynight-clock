import { useEffect, useState } from 'react';
import { loadShowMarkers, saveShowMarkers } from '../lib/settings';

/**
 * Whether the reader's markers are drawn on the dial, and a setter. Same shape
 * and same reasoning as `useYearKnob`: the initial value is read from storage
 * once through the `useState` initialiser, so an unavailable `localStorage`
 * costs one call rather than one per render, and every change is persisted from
 * an effect.
 *
 * Visibility only — the markers themselves live in `useMarkers`, and hiding
 * them touches nothing there.
 */
export function useShowMarkers(): [boolean, (next: boolean) => void] {
  const [showMarkers, setShowMarkers] = useState<boolean>(loadShowMarkers);

  useEffect(() => {
    saveShowMarkers(showMarkers);
  }, [showMarkers]);

  return [showMarkers, setShowMarkers];
}
