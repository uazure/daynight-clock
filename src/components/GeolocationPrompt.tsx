import { useRef } from 'react'
import { ModalSheet } from './ModalSheet'

interface Props {
  onAccept: () => void
  onDecline: () => void
}

export function GeolocationPrompt({ onAccept, onDecline }: Props) {
  // This is the app's first interaction, and the one place the spec cares
  // most that the explanation is actually read before anything happens — so
  // focus has to land on the affirmative choice, not merely inside the sheet.
  const acceptRef = useRef<HTMLButtonElement>(null)

  return (
    // Escape must never be a path to requesting position — ModalSheet routes
    // it to `onClose`, which here is exactly "Not now". The scrim is not a
    // dismissal surface: consent ends through an explicit choice only.
    <ModalSheet labelledBy="geo-title" onClose={onDecline} initialFocusRef={acceptRef}>
      <h2 id="geo-title">Show sunrise and sunset where you are?</h2>
      <p>
        The clock shades the dial with the hours of daylight, twilight and night
        at your location. To work that out it needs a rough idea of where you
        are — roughly, not precisely: it asks for a low-accuracy fix and rounds
        it to about a kilometre.
      </p>
      <p>
        Your coordinates stay on this device. There is no server, and nothing is
        sent anywhere.
      </p>
      <p className="sheet-note">
        Your browser will ask for permission next. You can skip this and pick a
        city by hand instead.
      </p>
      <div className="sheet-actions">
        <button type="button" onClick={onDecline}>
          Not now
        </button>
        <button type="button" className="primary" onClick={onAccept} ref={acceptRef}>
          Use my location
        </button>
      </div>
    </ModalSheet>
  )
}
