import { useEffect, useState } from 'react';
import { loadHour12, saveHour12 } from '../lib/settings';

/**
 * Whether times are written on a 12-hour clock, and a setter. Same shape as
 * `useShowDigitalTime`, and a separate hook rather than a field beside it
 * because the two are independent: the format governs the countdown's labels
 * and the dial's accessible name whether or not the digital block is drawn.
 */
export function useHour12(): [boolean, (next: boolean) => void] {
  const [hour12, setHour12] = useState<boolean>(loadHour12);

  useEffect(() => {
    saveHour12(hour12);
  }, [hour12]);

  return [hour12, setHour12];
}
