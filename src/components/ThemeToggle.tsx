import { useTheme } from '../hooks/useTheme';
import type { ThemePreference } from '../lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

/**
 * A link-styled three-way cycle, sitting on the panel's place line. Cycling
 * rather than a select keeps it to one small inline control on the only
 * strip of chrome the app has.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useTheme();

  return (
    <button
      type="button"
      className="link"
      aria-label={`Theme: ${preference}. Switch to ${NEXT[preference]}.`}
      onClick={() => setPreference(NEXT[preference])}
    >
      theme: {preference}
    </button>
  );
}
