import { useEffect, useRef } from 'react'

interface Props {
  onAccept: () => void
  onDecline: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function GeolocationPrompt({ onAccept, onDecline }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const acceptRef = useRef<HTMLButtonElement>(null)

  // This is the app's first interaction, and the one place the spec cares
  // most that the explanation is actually read before anything happens — so
  // focus has to land inside the dialog itself, not wherever it happened to
  // be (or nowhere) the moment the modal appeared.
  useEffect(() => {
    acceptRef.current?.focus()
  }, [])

  return (
    <div
      className="scrim"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          // Escape must never be a path to requesting position — treat it
          // exactly like clicking "Not now".
          event.preventDefault()
          onDecline()
          return
        }

        if (event.key !== 'Tab') return

        const sheet = sheetRef.current
        if (!sheet) return

        const focusable = sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        // Minimal focus trap: only the two buttons in this dialog are
        // focusable, so wrapping at the two ends keeps Tab from ever
        // reaching the (inert) app behind the scrim.
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <div
        ref={sheetRef}
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
          <button type="button" className="primary" onClick={onAccept} ref={acceptRef}>
            Use my location
          </button>
        </div>
      </div>
    </div>
  )
}
