import { useEffect, useState } from 'react';

/**
 * The current instant, refreshed on an interval while the tab is visible.
 *
 * Two seconds keeps the hands within 0.2° of true — the gain over a longer
 * interval is not that the motion looks smoother (it is sub-pixel either way)
 * but that a tab returning to the foreground is never visibly behind.
 *
 * Ticking stops while the tab is hidden and the time is refreshed the moment
 * it comes back, before the interval restarts, so the hands are already right
 * on the first frame the reader sees. Browsers throttle background timers to
 * about once a minute and eventually freeze them outright, so without that
 * refresh a returning tab would show a stale dial until the next tick.
 *
 * Keyed on visibility rather than focus deliberately: a window that is merely
 * unfocused is still on screen, and a clock you can see has to be right.
 */
export function useNow(intervalMs = 2_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };

    const start = () => {
      stop();
      id = setInterval(() => setNow(new Date()), intervalMs);
    };

    const sync = () => {
      if (document.hidden) {
        stop();
        return;
      }
      setNow(new Date());
      start();
    };

    sync();
    document.addEventListener('visibilitychange', sync);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [intervalMs]);

  return now;
}
