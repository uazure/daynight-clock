import { useEffect, useState } from 'react';
import type { Marker } from '../lib/markers';
import { loadMarkers, saveMarkers } from '../lib/settings';

/**
 * The reader's time markers, and a setter. Same shape and same reasoning as
 * `useSettings`: read from storage once through the `useState` initialiser, so an
 * unavailable `localStorage` costs one call rather than one per render, and
 * persist from an effect.
 *
 * Its own hook rather than more of `useSettings`, whose `[boolean, setter]` tuple
 * has nowhere to put a list — and the two are read by different parts of the
 * tree, so there is nothing to gain by joining them.
 */
export function useMarkers(): [Marker[], (next: Marker[]) => void] {
  const [markers, setMarkers] = useState<Marker[]>(loadMarkers);

  useEffect(() => {
    saveMarkers(markers);
  }, [markers]);

  return [markers, setMarkers];
}
