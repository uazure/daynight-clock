/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Day/Night Clock',
        short_name: 'Day/Night',
        description:
          'A 24-hour analog clock whose dial is shaded by daylight, twilight and night at your location.',
        theme_color: '#171a1f',
        background_color: '#171a1f',
        display: 'standalone',
        // The same file the tab icon uses — one SVG scales to every size a
        // manifest icon is asked for, so a second identical copy bought
        // nothing.
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
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
})
