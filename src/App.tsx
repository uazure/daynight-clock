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
      {/*
        `display: contents` (see styles.css) keeps this wrapper invisible to
        layout — the flex children below still belong directly to `.app` —
        while giving the modal something to make `inert` when it is open, so
        a keyboard or screen-reader user cannot reach the clock or panel
        behind the scrim.
      */}
      <div className="app-content" inert={location.askingConsent}>
        <div className="clock-stage">
          <Clock now={now} profile={profile} />
        </div>

        <LocationPanel
          place={location.place}
          error={location.error}
          canLocate={location.permission !== 'unsupported' && location.permission !== 'denied'}
          onChooseCity={location.chooseCity}
          onUseDeviceLocation={location.useDeviceLocation}
        />
      </div>

      {location.askingConsent && (
        <GeolocationPrompt
          onAccept={location.acceptConsent}
          onDecline={location.declineConsent}
        />
      )}
    </main>
  )
}
