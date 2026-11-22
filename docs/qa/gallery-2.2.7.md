# Atlas 2.2.7 — Places, display quality and viewer

## Changes

Places now opens as saved photo collections instead of the review workbench.
Photos/Map switches the collection home; selecting a place opens its own media
screen at both phone and desktop sizes. New suggestions are reviewed separately.
Scanning, undo and recovery are under More; pin precision/coordinates and merging
are collapsed in the place editor. Existing membership, trip assignment, backup,
restore and exact-file reconnection remain available. Saved browsing does not
run geographic clustering; clustering runs when Review new places is opened.
Online maps use the existing OpenStreetMap tiles. Saved photos work offline.

Gallery settings exposes Saver (80/768), Balanced (92/1280), High (98/2560), plus
custom JPEG quality 70–98 and maximum long edge 512–2560. These are encoder
settings/pixel limits, not percentages of preserved original detail. Grid requests
use tile dimensions, media aspect ratio and device density. Native decode targets
that size, with bounded parallelism and persistent file-version/size/quality cache
keys. AI decoding keeps its existing 1600-pixel default. Cache pruning is batched
rather than sorting the directory per generated photo; previews can briefly exceed
the byte budget during a generation batch. Settings patch existing preferences,
invalidate display copies only and never alter originals, upload payloads or AI
indexes. Cache totals explicitly include photo/video previews, timeline frames and
motion clips, excluding originals, exports, cloud downloads and the AI index.

The WebView opening transition waits for the original bitmap and animates that
same source, removing the final preview/original dissolve. A delayed status notice
appears for a stalled original; Back cancels safely. App updates supplies its own
fixed centering instead of depending on public-site modal CSS.

## Optional native viewer

Gallery settings → Photo viewer → Try the native Android viewer. Disabled by
default pending physical-phone validation. Same APK, same local media permissions;
non-exported Activity, strict MediaStore IDs only, at most 2,000 currently loaded
items per session. Uses ViewPager2, region-subsampled ARGB original images, and
Media3 playback with native bottom video controls. Photo pinch/double-tap/quick
zoom are handled by the native image view. Vertical dismiss/WhatsApp shortcuts,
page spacing, auto-hiding controls, lifecycle player release and position restore
are implemented. Info/More return to existing Atlas tools; share/favourite actions
also return to Atlas's viewer. Cloud media uses the existing viewer. Some image
formats may not support region decoding on a particular Android version; More
provides access to the Atlas viewer. Pagination beyond the loaded native session,
thumbnail-to-native-screen transitions and physical-device frame pacing are not
claimed complete.

Dependencies: AndroidX ViewPager2 1.1.0 and Media3 exoplayer/ui 1.3.1 (Apache-2.0,
https://github.com/androidx/media), matching the existing Media3 version;
subsampling-scale-image-view-androidx 3.10.0 (Apache-2.0,
https://github.com/davemorrissey/subsampling-scale-image-view). The latter is an
established, older pinned library, not represented as actively maintained. Android
framework region decoding supplies pixel reads. No new AI model or paid service.

## Validation

- 495 JavaScript/TypeScript unit tests passed; seven signing/update tests passed.
- TypeScript and targeted ESLint passed (see final release verification).
- Gallery browser regression passed, including preview-preset persistence.
- Normal-motion and stalled-original viewer checks passed; rapid pointer swipes,
  original decode, anchored open/close and console checks use fixture media.
- Places browser workflow covers scan, confirmation, split/merge, visits,
  idempotent trip assignment, manual/no-GPS membership, bulk removal, undo,
  Photos/Map view, mobile layout, encrypted backup API flow, simulated restore
  and exact-file reconnection. Cloud/native responses are fixtures.
- Update browser test checks horizontal and vertical centering at 390×844,
  download/install approval, preferences and back navigation with native fixtures.
- Local Android Java and test-source compilation passed. All 13
  GalleryAdvancedToolsTest Robolectric tests passed after redirecting its writable
  cache and Maven dependency repository; initial attempt failed before tests due
  to a read-only home directory. Includes native viewer export/ID policy and
  cache profile validation/patching. This is not physical-device testing.
- Mobile bundle/Capacitor sync and production build passed. Production's existing
  local database-fixture fallback warnings do not indicate a cloud data write.

This build was superseded before publication by [2.2.8](gallery-2.2.8.md), which
records the final signed-release evidence. No personal cloud writes, uploads,
catalog changes, credential rotation or local data reset occurred.
