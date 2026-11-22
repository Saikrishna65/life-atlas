# Atlas Gallery 2.2.4

## Behaviour

- Navigation commits each swipe immediately. A subsequent gesture samples the
  current slide offset and interrupts it instead of being discarded during a
  220 ms lock. Keyboard steps use the latest selected ID even before React paints.
- Gallery status messages no longer consume taps; their buttons remain usable.
- A temporary shared image animates uniformly from the thumbnail to the contained
  original rectangle, using clipping for differing shapes. Exit reverses this to
  the visible tile. Animation resources are released; unavailable thumbnails and
  reduced motion use a simple fallback. Videos use their grid still for the morph.
- Chronological masonry preserves intrinsic aspect ratios. Wide landscapes can
  span two columns when the column heights allow a compact placement. Portrait
  photos remain tall. MediaStore camera orientation corrects display dimensions;
  original bytes, file stamps and cloud identity remain unchanged.
- Smart Search emits saved-text/label matches after a 180 ms typing pause. Visual
  refinement waits another 250 ms, so superseded prefixes do not invoke the encoder.
  Results remain browsable while refinement runs; pagination waits for completion.
- The native search cache retains decoded metadata, lowercased searchable text and
  primitive vectors, avoiding repeated Keystore decryption and JSON vector parsing.
  It is bounded to an estimated 24 MiB / 12,000 records, keyed by app-store scope and
  ciphertext SHA-256. Changed ciphertext replaces old entries; ranking corrections
  and permission/stamp checks still use current data.
- Cache memory expires after 30 seconds idle and is suspended/cleared on background
  or destruction. Persistent indexes and query-vector caches remain encrypted.
- Approved, already-installed visual models can prepare when Smart Search opens.
  The tokenizer is reused within the short-lived isolated worker; obsolete queued
  queries are skipped. No model download is initiated. The existing low-memory
  guard and 20-second idle worker release remain in place.

Cold visual encoding and first scans of large libraries still cost time. No phone
latency, battery, thermal or physical-device smoothness measurement is claimed.

## Validation

- JavaScript unit tests: 493 passed; signing/update tests: 7 passed.
- Natural-ratio layout tests cover portrait/wide layouts, overlap, bounds and date
  headers. New native tests cover cached-row reuse, invalidation, scope isolation,
  memory limits, idle/background release and rotated camera dimensions.
- Gallery full browser suite (normal motion), Places and Library suites passed
  using native fixtures. Focused normal/reduced-motion viewer scenarios accepted
  all three swipes and rapid keyboard steps. Shared opening/closing elements and
  screenshots were inspected. These are Chromium fixtures, not Android hardware.
- Focused staged-search browser test passed: saved results precede delayed visual
  matches, and superseded prefixes do not start visual inference. Native responses
  are fixtures; this measures behaviour, not real model/device latency.
- TypeScript and targeted ESLint passed. Production Next.js build exited successfully;
  the local PostgreSQL fixture was unavailable, causing existing slug-query fallback
  warnings. This does not validate database-backed public content.
- Mobile bundle and Capacitor sync passed. Debug source and unit-test compilation
  passed locally; full native execution and signed APK verification follow in CI.
- No personal cloud objects were uploaded, deleted, republished or reset.
