/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
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
