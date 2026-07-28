import { Clock } from './components/Clock'
import { GeolocationPrompt } from './components/GeolocationPrompt'
import { LocationPanel } from './components/LocationPanel'
import { useDayProfile } from './hooks/useDayProfile'
import { useLocation } from './hooks/useLocation'
import { useNow } from './hooks/useNow'

export default function App() {
  const location = useLocation()
  const now = useNow()
  const profile = useDayProfile(now, location.place.lat, location.place.lon)

  return (
    <main className="app">
      <Clock now={now} profile={profile} />

      <LocationPanel
        place={location.place}
        error={location.error}
        canLocate={location.permission !== 'unsupported' && location.permission !== 'denied'}
        onChooseCity={location.chooseCity}
        onUseDeviceLocation={location.useDeviceLocation}
      />

      {location.askingConsent && (
        <GeolocationPrompt
          onAccept={location.acceptConsent}
          onDecline={location.declineConsent}
        />
      )}
    </main>
  )
}
