import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadThemePreference, saveThemePreference } from './theme';

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

describe('the stored theme preference', () => {
  it('defaults to auto when nothing is stored', () => {
    expect(loadThemePreference()).toBe('auto');
  });

  it('round-trips explicit choices through storage', () => {
    for (const preference of ['light', 'dark', 'auto'] as const) {
      saveThemePreference(preference);
      expect(loadThemePreference()).toBe(preference);
    }
  });

  it('stores auto as an absence, not a value', () => {
    // `auto` means "no opinion — follow the device", and the boot script in
    // index.html treats any stored value as an explicit override.
    saveThemePreference('dark');
    saveThemePreference('auto');
    expect(localStorage.getItem('daynight.theme')).toBeNull();
  });

  it('treats an unrecognised stored value as auto', () => {
    localStorage.setItem('daynight.theme', 'sepia');
    expect(loadThemePreference()).toBe('auto');
  });

  it('reads as auto rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(loadThemePreference()).toBe('auto');
  });

  it('does not throw when storage writes fail', () => {
    vi.stubGlobal('localStorage', throwingStorage());
    expect(() => saveThemePreference('dark')).not.toThrow();
    expect(() => saveThemePreference('auto')).not.toThrow();
  });
});
