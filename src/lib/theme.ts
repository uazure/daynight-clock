/**
 * The stored theme preference. `auto` means "follow the device" and is
 * represented in storage as absence: the boot script in index.html applies
 * `data-theme` for any stored value before first paint, so only explicit
 * overrides may ever be present there.
 */
export type ThemePreference = 'auto' | 'light' | 'dark'

const THEME_KEY = 'daynight.theme'

export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'auto'
  } catch {
    // Storage unreadable: behave as if no choice was ever made.
    return 'auto'
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    // Safari private browsing (and a full storage quota) makes setItem throw
    // synchronously; a storage failure must degrade to an in-memory-only
    // session, not crash the toggle.
    if (preference === 'auto') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, preference)
  } catch {
    // ignored: the chosen theme still applies for this session
  }
}
