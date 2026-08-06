/**
 * Which build this is: the version, the commit it came from, and when it was
 * made. The three values are inlined by the `define` block in vite.config.ts;
 * everything here is about reading them back safely.
 *
 * The formatting below takes its input as an argument rather than reaching for
 * `BUILD`, which is what makes it testable — the constants differ on every
 * machine and every build, so a test that asserted on them would assert on the
 * clock.
 */

/**
 * Where the hashes resolve. Hard-coded rather than read from `package.json`,
 * which has no `repository` field: adding one only to read it back through a
 * fourth `define` is a longer path to the same string.
 */
const REPO_URL = 'https://github.com/uazure/daynight-clock';

/** How much of the hash is shown. Seven is what `git log --oneline` gives. */
const SHORT_LENGTH = 7;

export const BUILD = {
  version: __APP_VERSION__,
  /** The full 40-character sha, or `''` where the build had no git to ask. */
  commit: __COMMIT_HASH__,
  /** ISO 8601, UTC. */
  date: __BUILD_DATE__,
} as const;

/** The first seven characters of a sha — and nothing at all for an absent one. */
export function shortCommit(sha: string): string {
  return sha.slice(0, SHORT_LENGTH);
}

/**
 * Where to read the commit, or `null` when the build could not name one. Callers
 * render plain text for `null`: a link to `/commit/` with no sha is a 404, and a
 * build that does not know its own commit should say so rather than guess.
 */
export function commitUrl(sha: string): string | null {
  return sha === '' ? null : `${REPO_URL}/commit/${sha}`;
}

/**
 * The build stamp as a reader sees it — `5 Aug 2026, 14:32 UTC`.
 *
 * Pinned to UTC on purpose. A build time is a fact about a machine somewhere
 * else, so rendering it in the reader's zone invites them to compare it against
 * their own clock and read a meaning into the offset that is not there. It also
 * makes the value stable to quote in a bug report, and stable in the tests,
 * which run under a pinned `TZ` that is not the reader's either.
 *
 * An unparseable stamp yields `''` rather than `Invalid Date`: the line that
 * renders this drops it instead of showing the reader a broken string.
 */
export function formatBuildDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${formatted} UTC`;
}
