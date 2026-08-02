import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadShowSunArc, saveShowSunArc } from './settings';

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

describe('the stored daylight-arc preference', () => {
  it('defaults to off when nothing is stored', () => {
    expect(loadShowSunArc()).toBe(false);
  });

  it('round-trips both choices through storage', () => {
    for (const showSunArc of [true, false, true]) {
      saveShowSunArc(showSunArc);
      expect(loadShowSunArc()).toBe(showSunArc);
    }
  });

  it('stores the default as an absence, not a value', () => {
    // Same trick as `theme.ts` with `auto`: a fresh install and a deliberate
    // switch-off have to be the same state, or the two disagree after an upgrade
    // that changes the default.
    saveShowSunArc(true);
    saveShowSunArc(false);
    expect(localStorage.getItem('daynight.showSunArc')).toBeNull();
  });

  it('treats an unrecognised stored value as off', () => {
    // Only the exact string 'true' turns it on, so junk falls back to the
    // default rather than to whatever the junk resembles.
    localStorage.setItem('daynight.showSunArc', 'maybe');
    expect(loadShowSunArc()).toBe(false);
  });

  it("reads the previous default's off marker as off", () => {
    // The arc used to default to on, with 'false' written for the off choice.
    // Those keys are still out there, and they have to keep meaning off — this
    // is the whole of the migration for the flipped default.
    localStorage.setItem('daynight.showSunArc', 'false');
    expect(loadShowSunArc()).toBe(false);
  });

  it('reads as off rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadShowSunArc()).toBe(false);
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveShowSunArc(false)).not.toThrow();
    expect(() => saveShowSunArc(true)).not.toThrow();
  });
});
