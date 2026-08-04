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
 *
 * A third key, `daynight.showSunArc`, belonged to the opt-in daylight arc that
 * used to sit outside the rim. It is read by nothing now and no migration removes
 * it: an unknown key costs a few bytes, and a one-shot cleanup would be more code
 * than the thing it tidies.
 */

import { type Marker, parseMarkers } from './markers';

const YEAR_KNOB_KEY = 'daynight.showYearKnob';
const MARKERS_KEY = 'daynight.markers';
const SHOW_MARKERS_KEY = 'daynight.showMarkers';

/**
 * Whether the year knob is drawn, and with it the date it can simulate.
 *
 * **Off by default**, so the dial someone meets on first run is the clock and
 * nothing else. The knob is a good deal more than a decoration — it puts the face
 * into a state where the shading is no longer *now*, which is the one thing this
 * app otherwise promises unconditionally — and a reader who has not asked for that
 * should not be one stray drag away from it. Opting in is also what makes the
 * simulated-date notice over the dial honest rather than mysterious: you turned
 * this on, so you know what it is.
 *
 * `false` is therefore the absence case — `saveShowYearKnob(false)` removes the
 * key rather than writing it, so a fresh install and a deliberate switch-off are
 * the same state and a later change of default needs no migration.
 */
export function loadShowYearKnob(): boolean {
  try {
    // Only the exact string 'true' turns it on; absent, junk, or a hand-edited
    // 'false' all read as off.
    return localStorage.getItem(YEAR_KNOB_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveShowYearKnob(showYearKnob: boolean): void {
  try {
    if (showYearKnob) {
      localStorage.setItem(YEAR_KNOB_KEY, 'true');
    } else {
      localStorage.removeItem(YEAR_KNOB_KEY);
    }
  } catch {
    // ignored: the choice still applies for this session
  }
}

/**
 * Whether the reader's markers are drawn on the dial at all.
 *
 * **On by default** — the inverse of the year knob, because the two defaults
 * answer different questions. Markers exist only because the reader added them,
 * so adding one has to show it without a second step; a switch that started
 * off would make the markers sheet look broken. What this setting offers is the
 * other direction: a way to quiet the dial without deleting anything —
 * `loadMarkers` is untouched by it, so hiding and showing lose nothing.
 *
 * `true` is therefore the absence case — `saveShowMarkers(true)` removes the
 * key rather than writing it, so a fresh install and a deliberate switch-on are
 * the same state and a later change of default needs no migration.
 */
export function loadShowMarkers(): boolean {
  try {
    // Only the exact string 'false' hides; absent, junk, or a hand-edited
    // 'true' all read as shown.
    return localStorage.getItem(SHOW_MARKERS_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveShowMarkers(showMarkers: boolean): void {
  try {
    if (showMarkers) {
      localStorage.removeItem(SHOW_MARKERS_KEY);
    } else {
      localStorage.setItem(SHOW_MARKERS_KEY, 'false');
    }
  } catch {
    // ignored: the choice still applies for this session
  }
}

/**
 * The reader's own time markers, or `[]` when there are none.
 *
 * Absence is the default here too, and an empty list *is* the absence: a fresh
 * install and "I deleted the last one" have to be the same state, or an upgrade
 * that changed the default would disagree with one of them.
 *
 * Nothing is validated in this module. Whatever `JSON.parse` yields goes to
 * `parseMarkers`, which owns every judgement about what a marker may be — so a
 * hand-edited storage key degrades to a quieter dial rather than a thrown
 * render, and the rules live next to the type they describe.
 */
export function loadMarkers(): Marker[] {
  try {
    const raw = localStorage.getItem(MARKERS_KEY);
    return raw === null ? [] : parseMarkers(JSON.parse(raw));
  } catch {
    // Unreadable storage, or JSON that isn't. Either way: no markers.
    return [];
  }
}

export function saveMarkers(markers: Marker[]): void {
  try {
    if (markers.length === 0) {
      localStorage.removeItem(MARKERS_KEY);
    } else {
      localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
    }
  } catch {
    // ignored: storage unavailable, and the markers still apply for this session
  }
}
