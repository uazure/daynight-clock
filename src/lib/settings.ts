/**
 * Dial preferences that are not the theme.
 *
 * Same storage idiom as `theme.ts`, and for the same reasons: one key per
 * setting, the **default represented as absence** of the key, and every
 * `localStorage` call wrapped — Safari private browsing throws synchronously on
 * `setItem`, and a storage failure has to degrade to an in-memory session
 * rather than break the control that triggered it (AGENTS.md rule 3).
 *
 * Kept separate from `theme.ts` rather than folded into it because the theme is
 * read by the pre-paint boot script in `index.html`; nothing here is, so the two
 * have different constraints on when and how they may be read.
 */

const SUN_ARC_KEY = 'daynight.showSunArc';

/**
 * Whether the daylight arc is drawn outside the rim.
 *
 * Defaults to **off**, so the arc is opt-in. It defaulted to on when it first
 * arrived, on the argument that it replaced the "Sunrise 05:31 · Sunset 20:45"
 * line that used to sit under the dial and that dropping the default would drop
 * that information for anyone who never opens the settings. What that argument
 * missed is that the face already carries the same two instants: the gradient's
 * midpoint *is* the horizon, so sunrise and sunset are where the shading turns,
 * and the arc restates them as a second mark outside the rim. The plain dial is
 * the better default; the arc stays for readers who want the boundary called
 * out explicitly.
 *
 * That makes `false` the absence case — `saveShowSunArc(false)` removes the key
 * rather than writing it, so a fresh install and a deliberate switch-off are the
 * same state. The flip needs no migration either: the old default wrote nothing
 * and the old off state wrote `'false'`, neither of which is `'true'`, so
 * everyone lands on the new default except readers who switch it on from here.
 */
export function loadShowSunArc(): boolean {
  try {
    // Only the exact string 'true' turns it on. Anything else — absent, junk
    // from a hand-edited storage, or the 'false' the previous default wrote —
    // reads as off.
    return localStorage.getItem(SUN_ARC_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveShowSunArc(showSunArc: boolean): void {
  try {
    if (showSunArc) {
      localStorage.setItem(SUN_ARC_KEY, 'true');
    } else {
      localStorage.removeItem(SUN_ARC_KEY);
    }
  } catch {
    // ignored: the choice still applies for this session
  }
}
