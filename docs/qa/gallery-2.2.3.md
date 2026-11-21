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
- Android debug source and unit-test compilation: pass before the final packaging
  pass; signed CI also runs debug unit tests and debug/preview APK builds.
- Physical-device gesture smoothness, Google Play services segmentation, launcher
  confirmation and reproduction of the reported crash require testing on a phone.

Release/build evidence will be recorded after the signed workflow finishes.
