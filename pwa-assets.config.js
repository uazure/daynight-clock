import { defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * Rasterises `public/favicon.svg` into the PNGs a manifest actually needs.
 *
 * Run by hand, never as part of the build — the outputs are committed, like
 * `src/data/*.json`. The generator ships as a transitive dependency of
 * vite-plugin-pwa, so it resolves locally without being a dependency of this
 * project; `--yes` covers the case where that stops being true:
 *
 *   npx --yes @vite-pwa/assets-generator
 *   optipng -o9 -strip all public/*.png
 *
 * The optipng pass is lossless and worth the second command: it recompresses
 * the IDAT stream and drops the alpha channel from the two icons whose
 * background is opaque, for ~8% off each of those. Re-run it after every
 * regeneration — the generator overwrites these files.
 *
 * Why PNGs exist at all, given the SVG scales: Chrome's installability check
 * wants a 192x192 and a 512x512 raster icon, and an SVG at `sizes: "any"` does
 * not satisfy it. With only the SVG declared, Chrome on Android offers no
 * install option at all — which is exactly the state this file fixes. iOS is a
 * second gap: Safari ignores manifest icons for Add to Home Screen and looks
 * only for an `apple-touch-icon` link, or it screenshots the page instead.
 */
export default defineConfig({
  images: ['public/favicon.svg'],
  preset: {
    /*
     * True colour, overriding the generator's default of `quality: 60`. In
     * sharp any numeric `quality` implies `palette: true` — an 8-bit palette
     * with dithering on — and the dial is one long near-neutral gradient,
     * exactly the content that quantiser handles worst: the day/night ramp came
     * out visibly stippled at 512px. `quality: undefined` is what removes it,
     * because the generator merges its defaults *under* this object and sharp
     * ignores a non-numeric quality; `palette: false` alone leaves `quality: 60`
     * in place and changes nothing.
     *
     * Costs a few tens of kilobytes across four files, once, for assets that
     * double as the Android splash screen.
     *
     * This sits at the preset level, not inside each entry below: the entries
     * are `Asset`s, and `toResolvedAsset` reads only `padding`, `resizeOptions`
     * and `sizes` from them — a `png` key there is silently dropped.
     */
    png: { compressionLevel: 9, palette: false, quality: undefined },

    // `purpose: any` icons, drawn edge to edge on transparency exactly as the
    // tab favicon is. 0.05 padding keeps the disc's outline off the bitmap's
    // own edge, where it would otherwise be clipped by a pixel. No favicon.ico:
    // the SVG favicon already covers every browser this targets.
    transparent: {
      sizes: [192, 512],
      favicons: [],
      padding: 0.05,
      resizeOptions: { fit: 'contain', background: 'transparent' },
    },

    // Android crops maskable icons to whatever shape the launcher uses, so the
    // artwork has to survive losing its corners: 0.3 padding is the standard
    // safe zone and should not be tightened. The generator defaults this
    // background to white, which would put a white surround on a dark dial and
    // disagree with the splash screen — `#171a1f` is the manifest's own
    // `background_color` and `theme_color`.
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { fit: 'contain', background: '#171a1f' },
    },

    // iOS applies its own rounded-rect mask and composites transparency onto
    // black, so this one needs a real background too. Far less padding than the
    // maskable icon: nothing crops here beyond the corner radius, and the
    // generator's default 0.3 would leave the dial floating in a mostly empty
    // tile.
    apple: {
      sizes: [180],
      padding: 0.1,
      resizeOptions: { fit: 'contain', background: '#171a1f' },
    },
  },
});
