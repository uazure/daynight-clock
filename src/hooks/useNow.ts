import { useEffect, useState } from 'react'

/**
 * The current instant, refreshed on an interval. Ten seconds is plenty: the
 * dial has no second hand, so the minute hand moves 1° per interval at most.
 */
export function useNow(intervalMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
