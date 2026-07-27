import { useState } from 'react'
import { Clock } from './components/Clock'
import { useDayProfile } from './hooks/useDayProfile'
import { useNow } from './hooks/useNow'
import { resolveInitialPlace, type Place } from './lib/location'

export default function App() {
  const [place] = useState<Place>(resolveInitialPlace)
  const now = useNow()
  const profile = useDayProfile(now, place.lat, place.lon)

  return (
    <main className="app">
      <Clock now={now} profile={profile} />
      <p className="place">
        {place.label} · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}
      </p>
    </main>
  )
}
