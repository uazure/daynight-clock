import { useEffect, useState } from 'react';
import { loadShowSunArc, saveShowSunArc } from '../lib/settings';

/**
 * Whether the daylight arc is drawn, and a setter. Mirrors `useTheme`: the
 * initial value is read from storage once (lazily, via the `useState`
 * initialiser, so an unavailable `localStorage` costs one call and not one per
 * render), and every change is persisted from an effect.
 *
 * Unlike the theme this touches no DOM — nothing outside React needs to know,
 * and there is no pre-paint boot script to coordinate with, because the arc is
 * drawn inside the SVG rather than by CSS.
 */
export function useSettings(): [boolean, (next: boolean) => void] {
  const [showSunArc, setShowSunArc] = useState<boolean>(loadShowSunArc);

  useEffect(() => {
    saveShowSunArc(showSunArc);
  }, [showSunArc]);

  return [showSunArc, setShowSunArc];
}
