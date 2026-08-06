/// <reference types="vitest/config" />

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * The commit the bundle was built from, for the line in *What is this?*.
 *
 * `GITHUB_SHA` first because CI's checkout is a detached HEAD at `fetch-depth: 1`
 * — `rev-parse` still answers there, but the env var is the same value the deploy
 * step already stamps onto the Pages deployment, so the two cannot disagree.
 * Anything that is not a git checkout at all (a source tarball) falls through to
 * the empty string, and the UI drops the link rather than showing a hash it made
 * up. `execFileSync`, not `execSync`: no argument here reaches a shell.
 */
function commitHash(): string {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export default defineConfig({
  base: './',
  /*
   * Inlined at build time, and read back through `src/lib/build.ts`. Evaluated
   * once when this config loads, so under `vite dev` the date is when the dev
   * server started — which is the honest answer to "what is this build" there.
   *
   * Worth knowing when reading a version off a running app: the service worker
   * registers as `autoUpdate`, so what a reader sees is the version of the bundle
   * actually executing, not the newest one deployed. That is what makes it useful
   * in a bug report.
   */
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __COMMIT_HASH__: JSON.stringify(commitHash()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The Apple icon is reachable only from a `<link>` in index.html, so
      // nothing else would pull it into the precache. The manifest's own PNGs
      // need no entry here — they are matched by workbox's default glob.
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Day/Night Clock',
        short_name: 'Day/Night',
        description: 'A 24-hour analog clock whose dial is shaded by daylight, twilight and night at your location.',
        theme_color: '#171a1f',
        background_color: '#171a1f',
        display: 'standalone',
        // Rasters, not the SVG the tab icon uses: Chrome's installability
        // check requires a 192 and a 512 raster, and an SVG at `sizes: "any"`
        // does not count — declaring only the SVG is why Chrome on Android
        // offered no install option at all. Generated from that same SVG by
        // `pwa-assets.config.js` and committed; regenerate, don't hand-edit.
        //
        // The maskable copy is a separate entry rather than a second `purpose`
        // on the 512: it is padded to the launcher safe zone, so it is a
        // different image, and one file cannot honestly claim both purposes.
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Pinned so the suite is machine-independent. `sampleDay` indexes samples
    // by local wall-clock minute, which makes every fixture timezone-sensitive;
    // a DST-observing zone is chosen deliberately so the transition-day tests
    // actually have a transition to catch.
    env: { TZ: 'Europe/Prague' },
  },
});
