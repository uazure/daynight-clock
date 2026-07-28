import { useMemo } from 'react'
import {
  localDateKey,
  sampleDay,
  startOfLocalDay,
  type DayProfile,
} from '../lib/sun'

/**
 * The day's light profile, recomputed only when the local date or the location
 * changes — 1440 solar-position calls are far too many to repeat every tick.
 */
export function useDayProfile(now: Date, lat: number, lon: number): DayProfile {
  const dateKey = localDateKey(now)

  return useMemo(
    () => sampleDay(startOfLocalDay(dateKey), lat, lon),
    [dateKey, lat, lon],
  )
}
