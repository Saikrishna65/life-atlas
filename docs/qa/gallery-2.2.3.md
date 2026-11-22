# Atlas Gallery 2.2.3

## Changes

Fixed photo-grid density replaces two-finger grid resizing. Existing viewer pinch,
double-tap and pan remain. Opening and dismissal use a 140 ms opacity transition
instead of stretching a thumbnail or a captured video frame. Reduced motion skips
the exit delay and disables the fade.

Each logical Gallery view keeps its own scroll position. Media-list caches retain
native continuation cursors, are invalidated by native media revisions, and hold
at most six views / 6,000 metadata records. Bitmaps are not cached in this map.
Scroll restoration waits for content height when necessary and yields to user input.

Long-press OCR checks the held point. If no English text intersects it, the explicit
hold triggers subject extraction at that point. Manual Text/Sticker tabs remain.
The compact extraction dialog positions itself independently of public-site CSS.

Subject inference now runs through same-UID Messenger IPC in a non-exported
`:gallery_extraction` service, not in the Activity process. Requests are serial,
images are bounded to a 1,024-pixel longest edge for inference, unnecessary combined
foreground output is disabled, and worker disconnects / timeouts return fixed errors.
Unbinding tears down this on-demand worker; no warm/background subject loop is added.
The original crash's native stack is unavailable, so the exact device failure cause
is not confirmed. Official Google Play services segmentation remains model/device
dependent. No personal originals or cloud objects are changed by these fixes.

Gallery settings can request an Android pinned shortcut. The launcher owns the Add
confirmation; unsupported launchers display app-drawer instructions. This remains
one installation and one data store.

## Validation

- TypeScript and targeted ESLint: pass.
- JavaScript unit tests: 493 pass; APK signing/update tests: 7 pass.
- Chromium Gallery integration: reduced and normal motion pass. Tests cover fixed
  grid pinching, page scroll restoration, zoom/pan, long-press text hit versus
  subject fallback, worker-error UI, and centered desktop/phone extraction panels.
- Places and Library browser suites: pass, using native fixtures.
- Mobile bundle (168 assets) and Capacitor sync: pass. Production Next.js build
  exits successfully; the local PostgreSQL fixture was unavailable, so the build
  logged connection warnings and used its existing slug-query fallback. This does
  not validate database-backed public content.
- Android debug source and unit-test compilation: pass before the final packaging
  pass; signed CI also runs debug unit tests and debug/preview APK builds.
- Physical-device gesture smoothness, Google Play services segmentation, launcher
  confirmation and reproduction of the reported crash require testing on a phone.

Local Robolectric execution could not fetch its instrumented Android framework:
a workspace-home retry reached an HTTP 403 from the environment's Maven proxy.
CI execution is recorded below separately; native compilation passed locally.

## Signed release evidence

- [CI run 44918712089](https://github.com/Saikrishna65/life-atlas/actions/runs/44918712089):
  `install-update` successful; the job with live personal-cloud checks was skipped.
  Debug and preview native unit suites and both APK assemblies passed.
- APK application source: `b57299fffeea44486d29536a5eb98360b28a3438`.
- [Atlas 2.2.3 APK](https://github.com/Saikrishna65/life-atlas/releases/download/atlas-install-update-44918712089/atlas.apk):
  package `com.lifeatlas.app.next`, version code 39, 73,594,486 bytes.
- SHA-256: `af0201a771f4277ecb3367fe3945ad78980aed32405f62f19f97d6501be6e9f0`.
- Verified APK signer SHA-256:
  `2f19571f9d6a4a3b4c7250397b7618f04e047beeeaa0023713e2a6c0a745af7d`.
  Package, bytes and checksum match the public updater manifest.
- Additional isolated browser scenario:
  `GALLERY_SCROLL_ONLY=1 node tests/gallery/gallery-browser.mjs` passes for a deep
  Favourites page, native Back to Collections and a cached revisit of Favourites.

Test on a phone by opening a photo, zooming and swiping down repeatedly, holding
both text and a foreground subject, and returning from scrolled People/Favourites
pages. Confirm the pinned shortcut opens Gallery without creating another app.
No physical-device test was performed in this environment.
