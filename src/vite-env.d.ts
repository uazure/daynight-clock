/// <reference types="vite/client" />

/**
 * Build stamps, replaced textually by the `define` block in vite.config.ts. They
 * are bare globals rather than `import.meta.env` entries because the values are
 * not environment — they are facts about the build that produced this bundle.
 * Read them through `src/lib/build.ts`, which is where their failure cases live.
 */
declare const __APP_VERSION__: string;
declare const __COMMIT_HASH__: string;
declare const __BUILD_DATE__: string;
