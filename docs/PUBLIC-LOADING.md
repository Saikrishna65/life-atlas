# Public loading and motion preparation

## Scope

The public homepage, trips index, trip journals and the other public pages share
an asset-aware, route-keyed loading screen. `/secret`, `/admin`, API routes and
native storage/authentication are excluded. No credentials, external services or
new dependencies are introduced. The hero's composition, dissolve timing and
original film sources, and the globe's model/marker interactions remain intact.

## What ready means

The screen waits for the actual page to hydrate, all homepage chapter chunks to
mount, the document load event and fonts to finish, rendered display images to decode, poster/background
images to load, and mounted films to have a decoded first frame. The globe must
finish its geography/material setup and render a frame. Trip maps wait for their
initial tile batch to settle. Published manifest requests join the same gate.
A short 350ms quiet period catches late React/stylesheet/layout work; it is not a
fake percentage counter or a timeout that forces the loader to disappear.

The loader does not wait for complete video downloads or every original in a
paginated collection. Videos continue native streaming, and later filters, more-results
batches, full-screen originals and subsequently selected map tiles remain on
demand. Images use the page's existing responsive previews where provided. Records
without a separate preview retain their original public source and can require
a larger download.

A stalled request keeps the loader visible. After 18 seconds, recovery buttons
allow reloading or explicitly opening available content. Missing media and WebGL
failures can settle through accessible fallback content. The readiness mode is
`complete`, `degraded` (a failed asset/fallback), or `partial` (explicit manual
opening), recorded on the document and in the Performance readiness mark. The
loader never automatically declares a stalled request complete.

React's hidden retained/streaming route trees are excluded. Hidden readiness
markers in the active route are included. Listeners, asset handlers, frame IDs,
quiet/recovery timers and inert/scroll locks are released on route changes.
Same-page anchors, external links, downloads and modifier-key clicks do not start
a new page loader. Normal navigation and browser back both recheck readiness.

## Concrete performance changes

- Public Lenis scrolling is driven by the existing GSAP ticker, replacing two
  competing frame clocks with one. Private/native routes retain their original
  automatic Lenis clock and scrolling options.
- Public pages no longer mount the legacy navigation's unused scroll listeners,
  hero geometry reads and state updates. The approved public navigation remains.
- The motion director starts after preparation and ignores unrelated text/DOM
  mutations, avoiding repeated full-page selector scans and redundant refreshes.
- The globe and ribbon suspend ambient work behind the loader. Existing
  offscreen/tab-hidden suspension remains. Globe pointer work uses its cached
  visibility flag rather than running when it cannot be seen.
- Geography begins loading alongside the globe module and is reused between
  public globe instances. There is no change to polygon resolution or model data.
- Hero/collection/navigation links postpone route prefetching until the current
  page is ready, then restore Next's normal prefetching. The next hero film still
  buffers ahead of handoff; outgoing film sources are released after the dissolve.
- Hero, ribbon and published collection share one validated manifest request,
  with a 30-second cache, bounded entries, request timeout and retry on failure.
- Trip metadata and content share their ORM lookup using request-scoped
  `React.cache`; there is no cross-request private-data cache.

## Tradeoff and measurement limits

Preparing below-fold scenes before opening requires more upfront work than the
old partial reveal. This is intentional for the requested complete-page gate;
it must not be presented as a reduction in total initial bytes or a guaranteed
faster first paint. Large original 4K stock-film sources remain unchanged and can
still dominate real network transfer and device decoding costs.

Measurements use a local production server and fresh desktop Chromium contexts,
with local licensed film fixtures and synthetic map tiles. No network throttling,
Lighthouse score, physical Android testing or device frame-rate claim is implied.
The old homepage inspection found three placeholder chapters, 6/13 loaded DOM
images and no initialized globe at its early inspection point. The new gate
opens only after the current rendered collection and native first frames settle.

## Validation

- Production build (including TypeScript) and scoped ESLint.
- 51 public unit tests, including route exclusions, navigation classification,
  public manifest request sharing and retry after a rejected fetch.
- Desktop/mobile browser checks hold a real below-fold image request, verify
  the loader survives the recovery threshold, then release it and verify fonts,
  all current images/first frames, mounted chapters and globe readiness.
- Retained hidden route content cannot block or cause unnecessary asset loading.
- Trips index → journal → same-page route navigation → browser back, including
  map readiness and scroll/inert restoration.
- Reduced motion, failed WebGL, failed image, explicit partial recovery, and
  one shared manifest request across the three public consumers.

Browser artifacts: `work/qa-public-loading/`. Detailed test/build/lint logs and
before/after inspection data: `work/public-loading/`.

The retained-route check inserts its simulated hidden DOM only after hydration,
matching Next's retained-page lifecycle. It also covers navigation out of the
trip-finder dialog while the destination's RSC response is held: the dialog
closes, the loader occupies the foreground, and scrolling resumes on the new
journal. Recovery controls are checked at 844×390 as well as portrait viewports.
The hero regression now checks the loaded local `--font-hero` face instead of an
obsolete Google-font family-name substring.

## Observed production-server run

Fresh desktop Chromium contexts, local film/map fixtures, unthrottled local
network and software WebGL. These are readiness measurements, not live Vercel
latency or a before/after speedup claim.

| Page | DOM content loaded | Display assets/sections ready | Loaded rendered images | Destination prefetches before ready |
| --- | ---: | ---: | ---: | ---: |
| Homepage | 1.47 s | 8.07 s | 25 / 25 | 0 |
| Trips index | 0.66 s | 2.38 s | 3 / 3 | 0 |
| Sample trip journal | 1.00 s | 2.73 s | 29 / 29, including map tiles | 0 |

All three runs reported complete readiness and zero placeholder chapters when
the loader cleared. Homepage readiness includes the fully initialized globe.
Preparing the full homepage takes longer than its old partial display, which
left three chapters and several images unprepared at the initial inspection.

Failure checks also cover geography fetch failure and switching an unavailable
video CDN source to decoded local fallback frames. Film readiness follows the
requested source, rather than retaining a failed `currentSrc` state. The hero
regression samples overlapping playback and opacity inside animation frames,
avoiding timing drift from round trips to the test controller.

Cached media frames and failed video sources are reconciled from native element
state after hydration, covering load/error events that occurred before React
attached its listeners. Unavailable CDN films are tested through their actual
local fallback frames, rather than treating a source replacement as ready.
