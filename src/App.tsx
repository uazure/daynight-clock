import { useState } from 'react'
import { CityPickerModal } from './components/CityPickerModal'
import { Clock } from './components/Clock'
import { GeolocationPrompt } from './components/GeolocationPrompt'
import { LocationPanel } from './components/LocationPanel'
import { useDayProfile } from './hooks/useDayProfile'
import { useLocation } from './hooks/useLocation'
import { useNow } from './hooks/useNow'
import { deviceTimezone } from './lib/location'

export default function App() {
  const location = useLocation()
  const now = useNow()
  const [pickerOpen, setPickerOpen] = useState(false)
  // `tz` is absent only for fallback places and pre-tz stored overrides;
  // the device zone is the only sensible reading of "local time" there.
  const timeZone = location.place.tz ?? deviceTimezone()
  const profile = useDayProfile(now, location.place.lat, location.place.lon, timeZone)

  const modalOpen = location.askingConsent || pickerOpen

  return (
    <main className="app">
      {/*
        `display: contents` (see styles.css) keeps this wrapper invisible to
        layout — the flex children below still belong directly to `.app` —
        while giving the modals something to make `inert` when one is open, so
        a keyboard or screen-reader user cannot reach the clock or panel
        behind the scrim. The modals themselves render as siblings, outside
        the inert subtree.
      */}
      <div className="app-content" inert={modalOpen}>
        <div className="clock-stage">
          <Clock now={now} profile={profile} timeZone={timeZone} />
        </div>

        <LocationPanel
          place={location.place}
          error={location.error}
          onOpenPicker={() => setPickerOpen(true)}
        />
      </div>

      {pickerOpen && (
        <CityPickerModal
          canLocate={
            location.permission !== 'unsupported' && location.permission !== 'denied'
          }
          onChooseCity={location.chooseCity}
          onUseDeviceLocation={location.useDeviceLocation}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {location.askingConsent && (
        <GeolocationPrompt
          onAccept={location.acceptConsent}
          onDecline={location.declineConsent}
        />
      )}
    </main>
  )
}
