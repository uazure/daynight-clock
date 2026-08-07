/**
 * Dial preferences that are not the theme.
 *
 * Same storage idiom as `theme.ts`, and for the same reasons: one key per
 * setting, the **default represented as absence** of the key, and every
 * `localStorage` call wrapped — Safari private browsing throws synchronously on
 * `setItem`, and a storage failure has to degrade to an in-memory session
 * rather than break the control that triggered it (AGENTS.md rule 3).
 *
 * Two of the keys here are about *time* rather than about the dial's furniture —
 * whether the digital clock is drawn above the hub, and whether times are
 * written on a 12-hour clock — and their defaults are deliberately opposite:
 * the clock is on unless the key says `'false'`, the 12-hour format is off
 * unless the key says `'true'`. Each doc comment below argues its own direction.
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
const DIGITAL_TIME_KEY = 'daynight.showDigitalTime';
const HOUR12_KEY = 'daynight.hour12';

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
    return localStorage.getItem(YEAR_KNOB_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveShowYearKnob(showYearKnob: boolean): void {
  try {
    if (!showYearKnob) {
      localStorage.setItem(YEAR_KNOB_KEY, 'false');
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

/**
 * Whether the digital clock and date are drawn above the hub.
 *
 * **On by default**, which is the markers' idiom rather than the year knob's.
 * The knob is off by default because it puts the face into a state where the
 * shading is no longer *now* — the one thing the app otherwise promises
 * unconditionally — and a reader who has not asked for that should not be one
 * stray drag away from it. Digits change nothing about what the dial means:
 * they answer "is that 10:42 or 10:47?", which the hand alone cannot, so they
 * are the baseline and the purist switches them off.
 *
 * `true` is therefore the absence case, the same trick the other keys use.
 */
export function loadShowDigitalTime(): boolean {
  try {
    // Only the exact string 'false' hides it; absent, junk, or a hand-edited
    // 'true' all read as shown.
    return localStorage.getItem(DIGITAL_TIME_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveShowDigitalTime(showDigitalTime: boolean): void {
  try {
    if (showDigitalTime) {
      localStorage.removeItem(DIGITAL_TIME_KEY);
    } else {
      localStorage.setItem(DIGITAL_TIME_KEY, 'false');
    }
  } catch {
    // ignored: the choice still applies for this session
  }
}

/**
 * Whether times are written on a 12-hour clock. **Off by default** — the dial
 * is a 24-hour dial, and captioning it `10:44 PM` would have the face and its
 * own readout disagree about what kind of clock this is.
 *
 * It governs every time the app *writes*: the hub digits, the countdown's
 * label for an unnamed marker, and the sunrise and sunset in the dial's
 * accessible name. It deliberately does **not** reach `formatMinutesOfDay`,
 * which feeds `<input type="time">` values in the markers editor — the HTML
 * spec fixes that format at 24-hour and the browser localises the control's
 * display itself. That is the platform, not a gap left to close.
 *
 * `false` is the absence case, so a fresh install and a deliberate switch back
 * to 24-hour are one state.
 */
export function loadHour12(): boolean {
  try {
    // Inverted from the other two keys: only the exact string 'true' opts in.
    return localStorage.getItem(HOUR12_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveHour12(hour12: boolean): void {
  try {
    if (hour12) {
      localStorage.setItem(HOUR12_KEY, 'true');
    } else {
      localStorage.removeItem(HOUR12_KEY);
    }
  } catch {
    // ignored: the choice still applies for this session
  }
}
