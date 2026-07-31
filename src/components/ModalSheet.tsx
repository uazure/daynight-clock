import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface Props {
  /** id of the element naming the dialog, for `aria-labelledby`. */
  labelledBy: string
  /** Called for Escape and (when `dismissOnScrim`) clicks on the backdrop. */
  onClose: () => void
  /**
   * Where focus lands when the sheet opens; defaults to the sheet's first
   * focusable element. Focus must land *inside* the dialog — the app behind
   * the scrim is inert, so focus left out there is focus lost.
   */
  initialFocusRef?: RefObject<HTMLElement | null>
  /**
   * Whether clicking the scrim itself closes the sheet. Off by default: the
   * consent dialog must only ever close through an explicit choice.
   */
  dismissOnScrim?: boolean
  children: ReactNode
}

/**
 * The scrim-and-sheet dialog shared by the consent prompt and the city
 * picker: focus lands inside on open, Tab wraps at the sheet's ends, Escape
 * closes, and focus returns to wherever it was when the sheet unmounts.
 */
export function ModalSheet({
  labelledBy,
  onClose,
  initialFocusRef,
  dismissOnScrim = false,
  children,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  // Captured during the first render, not in the effect: by effect time the
  // app behind the scrim is already `inert` (and StrictMode's re-run of the
  // effect would re-capture after focus has moved into the sheet), so an
  // effect-time read loses the control that opened the dialog.
  const [previousFocus] = useState(() => document.activeElement)

  useEffect(() => {
    const target =
      initialFocusRef?.current ??
      sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    target?.focus()

    return () => {
      // Hand focus back to the control that opened the sheet (on first load
      // there is none, and focusing nothing is fine).
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
    // Mount-only: the sheet exists exactly once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissOnScrim && event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
          return
        }

        if (event.key !== 'Tab') return

        const sheet = sheetRef.current
        if (!sheet) return

        const focusable = sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        // Minimal focus trap: wrapping at the two ends keeps Tab from ever
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
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  )
}
