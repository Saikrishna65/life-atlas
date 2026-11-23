# Gallery responsiveness and local diagnostics

Source-only follow-up to `gallery-performance-storage.md`. No release/version change, APK, production/mobile build, deployment, push, device installation or cloud operation was performed.

## Changes

- Large Gallery grids use an interval index to find intersecting mosaic tiles/date headers. Queries preserve the original item order, including tiles backfilled into earlier gaps. Collections of at most 160 tiles keep the existing direct layout without allocating an index. The existing paging/metadata-cache limits remain in effect.
- Device, private-library and collection-cover thumbnails share two IntersectionObservers: a 240px nearby margin and the actual viewport. A nearby pending request gains visible priority when it enters the viewport.
- The existing three-slot thumbnail queue defers speculative requests during scroll/drag activity, then resumes 160ms after activity settles. Visible requests keep priority. Hidden documents stop starting new work; already running native calls finish. Cancelled consumers are discarded. Queue limits and private URL/session isolation remain intact.
- Gallery layout listeners suspend while the photo viewer covers the grid. Existing viewer buffers, native cache limits, offline-first data and thumbnail revision/quality invalidation are reused.
- Gallery settings → **App responsiveness** shows fixed numeric aggregates for native list/search/thumbnail requests, preview-cache hits, layout/window computation, mounted/loaded tile counts and mobile JavaScript first-screen/navigation timings. Nothing is persisted, logged or transmitted. No filenames, locations, search strings, image bytes or conversations are recorded.
- A manually started ten-second RAF interval sample is lazy-loaded; it stops on unmount, cancellation or document hiding. No sampling loop runs by default. Results do not represent native GPU FPS and depend on refresh rate.

Existing text-first search, delayed/cancellable semantic refinement, native incremental AI work and battery/thermal safeguards were retained. No second search pipeline or background AI loop was introduced. Authentication policy and public-site components are unchanged.

## Measurements

Synthetic Node/tsx run on this execution host (not Android): 100,000 positioned records, an 844px viewport and 600px overscan. One query returned 88 items and visited 205 tree nodes, versus 100,000 placement checks with the old full-array filter. Index construction took approximately 27.1ms; 1,000 varied nearby queries averaged approximately 0.0153ms each. These numbers describe this synthetic input/host only; construction is paid again when layout changes and uses additional bounded metadata memory.

The component fixture uses a 2,000-record mock library with progressive pagination. After loading at least 240 records, fewer than 100 tiles stayed mounted across multiple scroll positions. It verifies visible thumbnails eventually load; it does not assert a physical-device decode latency.

First-screen timing begins at mobile JavaScript bootstrap, ends on the first animation frame after the route commits and excludes native process/WebView launch before JavaScript. It can include optional authentication or user delay. Navigation timing covers app-router pathname transitions initiated by the mobile navigation helper. These timings do not imply that every asynchronous photo has decoded or every native operation finished.

## Validation

- Full TypeScript unit suite: 523 passed at the initial validation checkpoint, including shared observers, queued-work prioritization, index equivalence and numeric metrics. A later focused run passed all 18 performance tests, including two additional checks for stale navigation and frame-sampler cleanup.
- TypeScript and targeted ESLint passed.
- Gallery full workflow browser fixture passed: collections, viewer gestures/navigation, searching, explicit publication controls, responsive layouts and bounded large-library rendering.
- Cache-only fixture passed: coalescing, preview reuse and source/quality invalidation.
- Paging-only fixture passed: hidden-grid work stays paused while viewing, deliberate pagination and rapid navigation.
- Private-library fixture passed: session-bound previews, cache cleanup, restore/backup controls and responsive layouts.
- Responsiveness fixture passed: indexed scrolling, visible thumbnails, local diagnostics, clear timings, narrow viewport and sampler cleanup.

Commands: `npm test`, `npx tsc --noEmit`, targeted `npx eslint`, `node tests/gallery/gallery-browser.mjs`, its `GALLERY_CACHE_ONLY=1`, `GALLERY_PAGING_ONLY=1` and `GALLERY_RESPONSIVENESS_ONLY=1` variants, and `node tests/gallery/library-browser.mjs`.

Browser fixtures use native mocks and local test images. They perform no personal-file deletion, native inference or R2 writes. Android build/device, actual memory/battery/thermal behavior, native process startup and frame-time comparisons still need validation when the phone is available. The user's instruction to defer builds remains in effect.
