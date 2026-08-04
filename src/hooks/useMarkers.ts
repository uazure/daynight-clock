import { useEffect, useState } from 'react';
import type { Marker } from '../lib/markers';
import { loadMarkers, saveMarkers } from '../lib/settings';

/**
 * The reader's time markers, and a setter. Same shape and same reasoning as
 * `useTheme`: read from storage once through the `useState` initialiser, so an
 * unavailable `localStorage` costs one call rather than one per render, and
 * persist from an effect.
 *
 * Unlike the theme this touches no DOM — nothing outside React needs to know, and
 * there is no pre-paint boot script to coordinate with, because the markers are
 * drawn inside the SVG rather than by CSS.
 */
export function useMarkers(): [Marker[], (next: Marker[]) => void] {
  const [markers, setMarkers] = useState<Marker[]>(loadMarkers);

  useEffect(() => {
    saveMarkers(markers);
  }, [markers]);

  return [markers, setMarkers];
}
