import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useNarrowViewport } from '../hooks/useNarrowViewport';

/**
 * CAUTION: this matches *focusable candidates*, and the trap below assumes each
 * match is its own **tab stop**. Three kinds of element break that assumption:
 *
 * - unchecked radios in a group (a group is one stop, however many radios),
 * - `disabled` controls (matched here, not focusable),
 * - controls hidden by CSS (likewise).
 *
 * When any of those are present, `focusable[0]` and the last entry stop being the
 * real ends of the tab order and the trap leaks — Shift-Tab from a checked radio
 * that was not the first match escaped the sheet into the browser chrome, which
 * is why the theme control is a `<select>` and not a radio group. None of the
 * three exist in the app today; if one arrives, collapse the list to real tab
 * stops before taking its first and last.
 */
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface Props {
  /** id given to the heading this renders, and pointed at by `aria-labelledby`. */
  labelledBy: string;
  /** The sheet's heading, rendered into the header that never scrolls. */
  title: ReactNode;
  /**
   * The one way out, called by all four of them: the sheet's own close control,
   * Escape, and a click on the backdrop.
   */
  onClose: () => void;
  /**
   * Where focus lands when the sheet opens; defaults to the sheet itself. Focus
   * must land *inside* the dialog — the app behind the scrim is inert, so focus
   * left out there is focus lost.
   *
   * Pass this only where a particular control is the reason the sheet opened
   * (the picker's search field, or the button a closing child sheet came back
   * from). "The first focusable" is deliberately *not* the default: it depends on
   * which control happens to be first in the DOM, which made the wide-screen
   * sheets open on their own X, and made *What is this?* open on the commit link
   * in its build stamp the moment that line was added.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Where focus goes when the sheet closes, overriding whatever happened to be
   * focused when it opened.
   *
   * Needed because sheets *replace* each other: menu → settings → picker each
   * unmount the previous one, so the auto-captured `previousFocus` of every sheet
   * after the first is a control that is being removed from the DOM in the same
   * commit. Focusing a detached element silently does nothing, so the chain used
   * to end with focus on `<body>` — keyboard users lost their place entirely.
   * `App` passes the element that opened the chain, which stays in the document
   * the whole time.
   */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Where the sheet sits inside the scrim. `center` is the dialog default;
   * `anchor-start` pins it to the top-left corner, under the control that opened
   * it, which is what makes the burger menu feel like a menu rather than a
   * dialog while still getting the focus trap and Escape handling below.
   *
   * It also decides whether the sheet renders a close control at all: an anchored
   * sheet is a popover, dismissed by choosing from it, and a Close row under two
   * menu items is a third item that does what Escape and the backdrop already do.
   */
  placement?: 'center' | 'anchor-start';
  /** Extra class on the sheet itself, for callers that need a narrower card. */
  sheetClassName?: string;
  /**
   * Extra class on the scrolling body, for a caller that lays its own content
   * out. The city picker passes `picker-body` and drops its own wrapper, so the
   * element that scrolls and the element that arranges the column are one — a
   * nested box between them is a second height for the results list to flex
   * against, and on a phone the list has to flex against the sheet's.
   */
  bodyClassName?: string;
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
 *
 * **The heading, the close control and the action row are this component's to
 * render, not the caller's.** They used to be ordinary children, which made the
 * sheet one flat scrolling column — and on a phone the settings sheet is taller
 * than the screen, so *Close* sat below the fold and could only be reached by
 * scrolling to it. A caller cannot opt out of chrome that must never scroll, so
 * it is structural here: header, then the one scrolling region, then the
 * actions. styles.css carries the matching three-row rule.
 *
 * **The close control is one control that changes place, not two that take
 * turns.** On a phone the sheet is the page and the dismiss belongs on the
 * action row at the bottom right, where a thumb already is; on anything wider it
 * is a card and the dismiss is an X in its top-right corner. Which one exists is
 * decided in JS (`useNarrowViewport`) rather than by hiding one in CSS, because
 * a hidden control still matches `FOCUSABLE_SELECTOR` without being a tab stop
 * and would put the trap back in the state AGENTS.md rule 9 describes.
 */
export function ModalSheet({
  labelledBy,
  title,
  onClose,
  initialFocusRef,
  restoreFocusRef,
  placement = 'center',
  sheetClassName,
  bodyClassName,
  children,
}: Props) {
  const narrow = useNarrowViewport();
  // The menu is a popover; only the dialogs carry a close control. See `placement`.
  const closeControl = placement === 'center';
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
  // `document.activeElement` can be null. `restoreFocusRef` is read in the
  // cleanup on purpose — reading it late is what makes it point at the live
  // origin of the chain rather than at whatever it held on mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only, see above
  useEffect(() => {
    const target = initialFocusRef?.current ?? sheetRef.current;
    target?.focus();

    return () => {
      // Hand focus back: the caller's chosen anchor if it gave one, else whatever
      // was focused when this sheet opened (on first load there is none, and
      // focusing nothing is fine). The anchor wins because a replaced sheet's own
      // capture is a control that is being detached in the same commit, and
      // focusing a detached node silently does nothing.
      const anchor = restoreFocusRef?.current ?? previousFocus;
      if (anchor instanceof HTMLElement) {
        anchor.focus();
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
        // Every sheet dismisses this way now. It used to be opt-in, for "a dialog
        // whose choice must be made explicitly" — but no such dialog survives:
        // the blocking consent modal that wanted it is gone (rule 4), and closing
        // any sheet that is left decides nothing.
        if (event.target === event.currentTarget) {
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
        /*
         * So the sheet itself can take focus on open, which is what makes a
         * screen reader announce the dialog and its title rather than whichever
         * control happens to be first. `-1` keeps it out of the tab order, and
         * out of `FOCUSABLE_SELECTOR` — the trap's ends are unaffected.
         */
        tabIndex={-1}
      >
        <div className="sheet-header">
          <h2 id={labelledBy}>{title}</h2>

          {closeControl && !narrow && (
            <button type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className={bodyClassName ? `sheet-body ${bodyClassName}` : 'sheet-body'}>{children}</div>

        {/*
          Last in the DOM, which is load-bearing rather than incidental: the trap
          above takes the first and last matches of `FOCUSABLE_SELECTOR`, so this
          is what keeps *Close* the final tab stop — and what keeps an
          `<input type="time">`, whose internal segments browsers disagree about
          tabbing between, off that end in the markers sheet.
        */}
        {closeControl && narrow && (
          <div className="sheet-actions">
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
