import { useMemo } from 'react'
import { sampleDay, type DayProfile } from '../lib/sun'
import { dateKeyInZone } from '../lib/time'

/**
 * The day's light profile, recomputed only when the date **in the place's own
 * zone** or the location changes — 1440 solar-position calls are far too many
 * to repeat every tick. Keying on the zone's date means the profile rolls
 * over at the city's midnight, not the device's.
 */
export function useDayProfile(
  now: Date,
  lat: number,
  lon: number,
  timeZone: string,
): DayProfile {
  const dateKey = dateKeyInZone(now, timeZone)

  return useMemo(
    () => sampleDay(dateKey, lat, lon, timeZone),
    [dateKey, lat, lon, timeZone],
  )
}
