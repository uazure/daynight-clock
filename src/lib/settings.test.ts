import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Marker } from './markers';
import {
  loadHour12,
  loadMarkers,
  loadShowDigitalTime,
  loadShowMarkers,
  loadShowYearKnob,
  saveHour12,
  saveMarkers,
  saveShowDigitalTime,
  saveShowMarkers,
  saveShowYearKnob,
} from './settings';

/** Minimal in-memory localStorage, enough for the one key this module uses. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  } as Storage;
}

/**
 * A localStorage stand-in whose read/write methods throw, mimicking Safari
 * private browsing or a storage quota failure.
 */
function throwingStorage(): Storage {
  const boom = () => {
    throw new Error('storage unavailable');
  };
  return {
    get length() {
      return 0;
    },
    clear: boom,
    getItem: boom,
    key: () => null,
    removeItem: boom,
    setItem: boom,
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the stored year-knob preference', () => {
  it('defaults to on when nothing is stored', () => {
    // The dial someone meets on first run is the clock and nothing else.
    expect(loadShowYearKnob()).toBe(true);
  });

  it('round-trips both choices through storage', () => {
    for (const on of [true, false, true]) {
      saveShowYearKnob(on);
      expect(loadShowYearKnob()).toBe(on);
    }
  });

  it('stores the default as an absence, not a value', () => {
    saveShowYearKnob(false);
    saveShowYearKnob(true);
    expect(localStorage.getItem('daynight.showYearKnob')).toBeNull();
  });

  it('treats an unrecognised stored value as on', () => {
    localStorage.setItem('daynight.showYearKnob', 'maybe');
    expect(loadShowYearKnob()).toBe(true);
  });

  it('reads as on rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadShowYearKnob()).toBe(true);
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveShowYearKnob(true)).not.toThrow();
    expect(() => saveShowYearKnob(false)).not.toThrow();
  });
});

describe('the stored marker-visibility preference', () => {
  it('defaults to shown when nothing is stored', () => {
    // The inverse default of the year knob: markers exist only because the
    // reader added them, so adding one must show it without a second step.
    expect(loadShowMarkers()).toBe(true);
  });

  it('round-trips both choices through storage', () => {
    for (const shown of [false, true, false]) {
      saveShowMarkers(shown);
      expect(loadShowMarkers()).toBe(shown);
    }
  });

  it('stores the default as an absence, not a value', () => {
    // Same trick as the year knob, mirrored: `shown` is the absence case, so a
    // fresh install and a deliberate switch-on are the same state.
    saveShowMarkers(false);
    saveShowMarkers(true);
    expect(localStorage.getItem('daynight.showMarkers')).toBeNull();
  });

  it('treats an unrecognised stored value as shown', () => {
    localStorage.setItem('daynight.showMarkers', 'maybe');
    expect(loadShowMarkers()).toBe(true);
  });

  it('reads as shown rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadShowMarkers()).toBe(true);
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveShowMarkers(true)).not.toThrow();
    expect(() => saveShowMarkers(false)).not.toThrow();
  });
});

describe('the stored markers', () => {
  const markers: Marker[] = [
    { label: 'Wake', start: 390, end: null },
    { label: 'Work', start: 540, end: 1080 },
  ];

  it('defaults to none when nothing is stored', () => {
    expect(loadMarkers()).toEqual([]);
  });

  it('round-trips a moment and an interval through storage', () => {
    saveMarkers(markers);
    expect(loadMarkers()).toEqual(markers);
  });

  it('stores an empty list as an absence, not as "[]"', () => {
    // Same trick as `theme.ts` before it: a fresh install and
    // "I deleted the last one" are one state, so an upgrade that changed the
    // default could not disagree with one of them.
    saveMarkers(markers);
    saveMarkers([]);
    expect(localStorage.getItem('daynight.markers')).toBeNull();
  });

  it('reads junk as no markers rather than throwing mid-render', () => {
    // Everything about *what* a marker may be is `parseMarkers`' business; this
    // only checks that neither unparseable JSON nor the wrong shape escapes.
    for (const raw of ['not json', '{"start":0}', '[{"label":"Work"}]', 'null']) {
      localStorage.setItem('daynight.markers', raw);
      expect(loadMarkers(), raw).toEqual([]);
    }
  });

  it('reads as none rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadMarkers()).toEqual([]);
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveMarkers(markers)).not.toThrow();
    expect(() => saveMarkers([])).not.toThrow();
  });
});

describe('the stored digital-time preference', () => {
  it('defaults to shown when nothing is stored', () => {
    // Follows the markers idiom rather than the year knob's: the knob is off by
    // default because it puts the face into a state where the shading is no
    // longer *now*, which is the one thing the app otherwise promises
    // unconditionally. Digits change nothing about what the dial means.
    expect(loadShowDigitalTime()).toBe(true);
  });

  it('round-trips both choices through storage', () => {
    for (const shown of [false, true, false]) {
      saveShowDigitalTime(shown);
      expect(loadShowDigitalTime()).toBe(shown);
    }
  });

  it('stores the default as an absence, not a value', () => {
    saveShowDigitalTime(false);
    saveShowDigitalTime(true);
    expect(localStorage.getItem('daynight.showDigitalTime')).toBeNull();
  });

  it('treats an unrecognised stored value as shown', () => {
    localStorage.setItem('daynight.showDigitalTime', 'maybe');
    expect(loadShowDigitalTime()).toBe(true);
  });

  it('reads as shown rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadShowDigitalTime()).toBe(true);
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveShowDigitalTime(true)).not.toThrow();
    expect(() => saveShowDigitalTime(false)).not.toThrow();
  });
});

describe('the stored time-format preference', () => {
  it('defaults to 24-hour when nothing is stored', () => {
    // The dial is a 24-hour dial. A face captioned "10:44 PM" fights itself, so
    // 12-hour is the opt-in and absence of the key is 24-hour.
    expect(loadHour12()).toBe(false);
  });

  it('round-trips both choices through storage', () => {
    for (const hour12 of [true, false, true]) {
      saveHour12(hour12);
      expect(loadHour12()).toBe(hour12);
    }
  });

  it('stores the default as an absence, not a value', () => {
    saveHour12(true);
    saveHour12(false);
    expect(localStorage.getItem('daynight.hour12')).toBeNull();
  });

  it('treats an unrecognised stored value as 24-hour', () => {
    localStorage.setItem('daynight.hour12', 'maybe');
    expect(loadHour12()).toBe(false);
  });

  it('reads as 24-hour rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadHour12()).toBe(false);
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveHour12(true)).not.toThrow();
    expect(() => saveHour12(false)).not.toThrow();
  });
});
