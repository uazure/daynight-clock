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
  it('defaults to on when nothing is stored', () => {
    expect(loadShowSunArc()).toBe(true);
  });

  it('round-trips both choices through storage', () => {
    for (const showSunArc of [false, true, false]) {
      saveShowSunArc(showSunArc);
      expect(loadShowSunArc()).toBe(showSunArc);
    }
  });

  it('stores the default as an absence, not a value', () => {
    // Same trick as `theme.ts` with `auto`: a fresh install and a deliberate
    // re-enable have to be the same state, or the two disagree after an upgrade
    // that changes the default.
    saveShowSunArc(false);
    saveShowSunArc(true);
    expect(localStorage.getItem('daynight.showSunArc')).toBeNull();
  });

  it('treats an unrecognised stored value as on', () => {
    // Only the exact string 'false' turns it off, so junk fails safe towards
    // showing the arc rather than silently hiding it.
    localStorage.setItem('daynight.showSunArc', 'maybe');
    expect(loadShowSunArc()).toBe(true);
  });

  it('reads as on rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadShowSunArc()).toBe(true);
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveShowSunArc(false)).not.toThrow();
    expect(() => saveShowSunArc(true)).not.toThrow();
  });
});
