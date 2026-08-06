import { useSyncExternalStore } from 'react';

/**
 * The one breakpoint the sheets change shape at, and the same value the
 * `@media (max-width: 40rem)` block in styles.css uses. The two have to agree:
 * below it a sheet is the page and its dismiss control is a *Close* button on
 * the action row, above it the sheet is a card and the control is an X in the
 * corner. Change one and change the other.
 */
const NARROW = '(max-width: 40rem)';

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

const getSnapshot = () => window.matchMedia(NARROW).matches;

/**
 * Whether the viewport is phone-width, as state rather than as a CSS rule.
 *
 * A media query alone would be the obvious way to swap the two dismiss controls,
 * and it is the wrong one: hiding one of them with `display: none` leaves it in
 * the DOM, where it still matches `ModalSheet`'s `FOCUSABLE_SELECTOR` without
 * being a tab stop — which is precisely the shape of bug AGENTS.md rule 9
 * records. Deciding here means the sheet renders exactly one close control and
 * the focus trap's first-and-last reasoning stays true.
 *
 * `useSyncExternalStore` rather than an effect and a `useState`: it subscribes
 * during the commit React is already doing, so a rotation between render and
 * effect cannot leave the sheet showing the wrong control.
 */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
