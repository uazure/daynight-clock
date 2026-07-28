interface Props {
  onAccept: () => void
  onDecline: () => void
}

export function GeolocationPrompt({ onAccept, onDecline }: Props) {
  return (
    <div className="scrim" role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="geo-title"
      >
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
          <button type="button" className="primary" onClick={onAccept}>
            Use my location
          </button>
        </div>
      </div>
    </div>
  )
}
