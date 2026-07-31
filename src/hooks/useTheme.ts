import { useEffect, useState } from 'react';
import { loadThemePreference, saveThemePreference, type ThemePreference } from '../lib/theme';

/**
 * Browser-chrome colours matching the two `--bg` values in styles.css; the
 * PWA manifest's copy of the dark one is static and stays dark — a known
 * limitation, like the SVG-only icon.
 */
const THEME_COLOR = { dark: '#171a1f', light: '#f4f4f6' } as const;

/**
 * Keeps the `theme-color` metas in step: under `auto` each of the two
 * media-qualified metas answers for its own scheme; an explicit choice makes
 * both answer with that scheme's colour, since the page no longer follows
 * the device.
 */
function applyThemeColorMeta(preference: ThemePreference): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('light') ? 'light' : 'dark';
    meta.content = THEME_COLOR[preference === 'auto' ? own : preference];
  }
}

/**
 * The theme preference and a setter. `auto` (the default) removes the
 * `data-theme` attribute so the CSS `prefers-color-scheme` rules decide;
 * an explicit choice pins the attribute and persists. The boot script in
 * index.html applies the stored attribute before first paint — this hook
 * only has to keep it current from then on.
 */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(loadThemePreference);

  useEffect(() => {
    if (preference === 'auto') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = preference;
    }
    saveThemePreference(preference);
    applyThemeColorMeta(preference);
  }, [preference]);

  return [preference, setPreference];
}
