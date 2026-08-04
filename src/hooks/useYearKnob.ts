import { useEffect, useState } from 'react';
import { loadShowYearKnob, saveShowYearKnob } from '../lib/settings';

/**
 * Whether the year knob is on, and a setter. Same shape and same reasoning as
 * `useMarkers` and `useTheme`: the initial value is read from storage once through
 * the `useState` initialiser, so an unavailable `localStorage` costs one call
 * rather than one per render, and every change is persisted from an effect.
 *
 * Touches no DOM — nothing outside React needs to know, and there is no pre-paint
 * boot script to coordinate with, because the knob is drawn inside the SVG rather
 * than by CSS.
 */
export function useYearKnob(): [boolean, (next: boolean) => void] {
  const [showYearKnob, setShowYearKnob] = useState<boolean>(loadShowYearKnob);

  useEffect(() => {
    saveShowYearKnob(showYearKnob);
  }, [showYearKnob]);

  return [showYearKnob, setShowYearKnob];
}
