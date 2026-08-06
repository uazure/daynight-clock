import { describe, expect, it } from 'vitest';
import { BUILD, commitUrl, formatBuildDate, shortCommit } from './build';

describe('shortCommit', () => {
  it('takes the first seven characters, as git log --oneline does', () => {
    expect(shortCommit('409bee5bd8c4835f79efd67400db6b3999de5819')).toBe('409bee5');
  });

  it('yields nothing for the empty sha a non-git build produces', () => {
    expect(shortCommit('')).toBe('');
  });
});

describe('commitUrl', () => {
  it('points at the commit on GitHub', () => {
    expect(commitUrl('409bee5bd8c4835f79efd67400db6b3999de5819')).toBe(
      'https://github.com/uazure/daynight-clock/commit/409bee5bd8c4835f79efd67400db6b3999de5819',
    );
  });

  // A link to `/commit/` with no sha is a 404, so the caller renders plain text.
  it('is null when the build could not name a commit', () => {
    expect(commitUrl('')).toBeNull();
  });
});

describe('formatBuildDate', () => {
  /*
   * The suite runs under TZ=Europe/Prague, which is UTC+2 in August — so a
   * local-time format would render this as 16:32 and the assertion would move
   * with the machine. 14:32 passing is the proof that the UTC pin holds.
   */
  it('renders in UTC, not the running zone', () => {
    expect(formatBuildDate('2026-08-05T14:32:09.000Z')).toBe('5 Aug 2026, 14:32 UTC');
  });

  it('pads the hour and leaves the day unpadded', () => {
    expect(formatBuildDate('2026-01-09T04:05:00.000Z')).toBe('9 Jan 2026, 04:05 UTC');
  });

  // Rather than the literal `Invalid Date` that `toLocaleString` would give.
  it('yields nothing for a stamp it cannot parse', () => {
    expect(formatBuildDate('')).toBe('');
    expect(formatBuildDate('not a date')).toBe('');
  });
});

describe('BUILD', () => {
  /*
   * The values themselves differ on every machine and every build, so this
   * asserts only that the `define` substitution happened at all — a missing
   * entry in vite.config.ts leaves the identifier undefined and fails here
   * rather than in the browser.
   */
  it('is populated by the build-time define', () => {
    expect(typeof BUILD.version).toBe('string');
    expect(typeof BUILD.commit).toBe('string');
    expect(formatBuildDate(BUILD.date)).not.toBe('');
  });
});
