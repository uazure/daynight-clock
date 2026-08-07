import { useEffect, useState } from 'react';
import { loadShowDigitalTime, saveShowDigitalTime } from '../lib/settings';

/**
 * Whether the digital clock and date are drawn, and a setter. Same shape and
 * same reasoning as `useShowMarkers`: the initial value is read from storage
 * once through the `useState` initialiser, so an unavailable `localStorage`
 * costs one call rather than one per render, and every change is persisted
 * from an effect.
 */
export function useShowDigitalTime(): [boolean, (next: boolean) => void] {
  const [showDigitalTime, setShowDigitalTime] = useState<boolean>(loadShowDigitalTime);

  useEffect(() => {
    saveShowDigitalTime(showDigitalTime);
  }, [showDigitalTime]);

  return [showDigitalTime, setShowDigitalTime];
}
