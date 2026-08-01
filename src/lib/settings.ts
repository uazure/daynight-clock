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
 * Defaults to **on**: the arc is what replaced the "Sunrise 05:31 · Sunset
 * 20:45" line that used to sit under the dial, so defaulting it off would drop
 * that information entirely for anyone who never opens the settings. That makes
 * `true` the absence case — `saveShowSunArc(true)` removes the key rather than
 * writing it, so a fresh install and a deliberate re-enable are the same state.
 */
export function loadShowSunArc(): boolean {
  try {
    // Only the exact string 'false' turns it off. Anything else — absent, or
    // junk left by a hand-edited storage — reads as the default.
    return localStorage.getItem(SUN_ARC_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveShowSunArc(showSunArc: boolean): void {
  try {
    if (showSunArc) {
      localStorage.removeItem(SUN_ARC_KEY);
    } else {
      localStorage.setItem(SUN_ARC_KEY, 'false');
    }
  } catch {
    // ignored: the choice still applies for this session
  }
}
