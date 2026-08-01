import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface Props {
  /** id of the element naming the dialog, for `aria-labelledby`. */
  labelledBy: string;
  /** Called for Escape and (when `dismissOnScrim`) clicks on the backdrop. */
  onClose: () => void;
  /**
   * Where focus lands when the sheet opens; defaults to the sheet's first
   * focusable element. Focus must land *inside* the dialog — the app behind
   * the scrim is inert, so focus left out there is focus lost.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Whether clicking the scrim itself closes the sheet. Off by default, for a
   * dialog whose choice must be made explicitly rather than by dismissal. The
   * city picker, currently the only caller, opts in — closing it decides
   * nothing.
   */
  dismissOnScrim?: boolean;
  /**
   * Where the sheet sits inside the scrim. `center` is the dialog default;
   * `anchor-start` pins it to the top-left corner, under the control that opened
   * it, which is what makes the burger menu feel like a menu rather than a
   * dialog while still getting the focus trap and Escape handling below.
   */
  placement?: 'center' | 'anchor-start';
  /** Extra class on the sheet itself, for callers that need a narrower card. */
  sheetClassName?: string;
  children: ReactNode;
}

/**
 * The scrim-and-sheet dialog behind the city picker, the main menu and the
 * settings: focus lands inside on open, Tab wraps at the sheet's ends, Escape
 * closes, and focus returns to wherever it was when the sheet unmounts.
 *
 * The menu shares all of that rather than reimplementing it. A two-item menu
 * looks like it wants a lighter component, but every behaviour it needs is one
 * of these, and each one here cost a bug to get right — see the notes on
 * `previousFocus` and on the dependency array below.
 */
export function ModalSheet({
  labelledBy,
  onClose,
  initialFocusRef,
  dismissOnScrim = false,
  placement = 'center',
  sheetClassName,
  children,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // Captured during the first render, not in the effect: by effect time the
  // app behind the scrim is already `inert` (and StrictMode's re-run of the
  // effect would re-capture after focus has moved into the sheet), so an
  // effect-time read loses the control that opened the dialog.
  const [previousFocus] = useState(() => document.activeElement);

  // Mount-only by design: the sheet exists exactly once per opening, so this
  // must run on open and its cleanup must run on close, and at no other time.
  //
  // Declaring the reads as dependencies actively breaks it, which is why the
  // suppression is here rather than a "fix". `initialFocusRef.current` goes from
  // null to the node after the first commit, so the cleanup fires
  // mid-interaction and hands focus back to the control that opened the sheet
  // while it is still open — the city picker reproduces it, its async
  // `loadCities().then(setCities)` guaranteeing the second render. And bare
  // `previousFocus.focus` in a dependency array dereferences a value the
  // cleanup below deliberately guards with `instanceof HTMLElement`, because
  // `document.activeElement` can be null.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only, see above
  useEffect(() => {
    const target = initialFocusRef?.current ?? sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();

    return () => {
      // Hand focus back to the control that opened the sheet (on first load
      // there is none, and focusing nothing is fine).
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    // The handlers here are not the accessible path to either behaviour, which
    // is why this stays a presentational backdrop rather than gaining a role.
    // Escape is handled on keydown because the event has to be caught wherever
    // focus currently sits inside the sheet, and the sheet is this element's
    // only child; backdrop dismissal is a pointer-only convenience that Escape
    // already covers for the keyboard. Giving the scrim an interactive role
    // would instead announce the backdrop itself as a control, which it is not.
    // biome-ignore lint/a11y/noStaticElementInteractions: presentational backdrop, see above
    <div
      className={placement === 'center' ? 'scrim' : 'scrim scrim-anchor-start'}
      role="presentation"
      onMouseDown={(event) => {
        if (dismissOnScrim && event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }

        if (event.key !== 'Tab') {
          return;
        }

        const sheet = sheetRef.current;
        if (!sheet) {
          return;
        }

        const focusable = sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        // Minimal focus trap: wrapping at the two ends keeps Tab from ever
        // reaching the (inert) app behind the scrim.
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div
        ref={sheetRef}
        className={sheetClassName ? `sheet ${sheetClassName}` : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  );
}
