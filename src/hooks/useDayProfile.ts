import { useMemo, useRef } from 'react';
import { type DayProfile, sampleDay } from '../lib/sun';

/**
 * How many profiles to keep. Each is two `Float64Array(1440)`, ~23 KB, so this
 * is about half a megabyte — worth it because a knob scrubbed back and forth
 * revisits days constantly, and `useMemo` alone holds exactly one. Twenty-four
 * covers a good sweep of a month before anything is recomputed.
 */
const CACHE_LIMIT = 24;

/**
 * The light profile of **a given day**, recomputed only when that day or the
 * location changes.
 *
 * Takes a `dateKey` rather than a `Date`, which is the whole of the decoupling
 * that lets the year knob work: this hook used to derive the date from `now`
 * itself, making it the one place a real clock became a shading date. Now the
 * caller decides which day to shade — today's, or one the reader has scrubbed to
 * — while the hands go on reading `now` directly. Nothing here knows a
 * simulation exists.
 *
 * Keying on a zone-local date string rather than an instant is also what makes
 * the profile roll over at the city's midnight rather than the device's; see
 * `dateKeyInZone`, which is now called one level up.
 *
 * The cache lives in a ref rather than in `sun.ts`, because per-session memory is
 * React's business and `src/lib` stays pure (AGENTS.md rule 3).
 */
export function useDayProfile(dateKey: string, lat: number, lon: number, timeZone: string): DayProfile {
  const cache = useRef<Map<string, DayProfile>>(new Map());

  return useMemo(() => {
    const key = `${dateKey}|${lat}|${lon}|${timeZone}`;
    const hit = cache.current.get(key);
    if (hit) {
      return hit;
    }

    const profile = sampleDay(dateKey, lat, lon, timeZone);
    cache.current.set(key, profile);
    // `Map` iterates in insertion order, so the first key is the oldest.
    if (cache.current.size > CACHE_LIMIT) {
      cache.current.delete(cache.current.keys().next().value as string);
    }
    return profile;
  }, [dateKey, lat, lon, timeZone]);
}
