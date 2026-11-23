# Gallery performance and storage — code-only update

The user requested no APK or production builds until they can test again.
Authentication is reserved for a subsequent task. This change does not alter its
code, credentials, biometric checks, publication approvals, or encrypted-index format.

## Implemented

- One shared thumbnail queue for device and private-library grids: at most three
  native requests at a time. Identical requests coalesce, visible images receive
  priority, and queued work whose consumers left the viewport is skipped. A failed
  request releases its slot and permits immediate retry.
- Private thumbnail results are not retained by the queue. Private component URLs
  belong to their current session and media ID. Offscreen elements stop displaying
  their image; returning to the same valid session can reuse that component's URL.
- Device preview requests use native pixel buckets. The 240-entry path cache uses
  access-based eviction, invalidates changed source stamps and rejects results
  from superseded quality settings or changed covers. Smaller late results do not
  displace larger variants. Auxiliary bookkeeping is bounded.
- Updating AI labels no longer flushes all unchanged device thumbnails. Restoring
  organisation explicitly invalidates preview settings, including restored covers.
- Logical Gallery collection pages use true LRU eviction. Invalid revisions release
  their old metadata; existing continuation tokens and scroll handling are retained.
- Opening Photos no longer enumerates all device albums immediately. Full album
  counts load when collections, search, album selection or analysis settings need them.
- The home music widget reads aggregate counts using an IndexedDB cursor rather
  than retaining every track and its audio blob in React state. Original tracks
  load for an explicit playback action. Repeated refreshes coalesce; an overlapping
  library-change event triggers one follow-up read. Shuffle uses Fisher–Yates.
- Viewer videos pause when the document is hidden. Resuming the app does not force
  playback. Existing unmount cleanup and saved video positions remain in use.
- Native preview pruning tracks each cache directory separately and also checks
  after 4 MiB of newly written previews. Timeline and motion cache hits avoid full
  directory sorting and repeated timestamp writes; creation invokes batched pruning.
- Cache reports show each category's usage and limit. Photo previews retain their
  chosen 32/64/96/192 MiB limit; timeline frames use 16 MiB and motion previews 64 MiB,
  matching the corresponding generators. These are separate soft limits: active
  writes and the currently protected file can temporarily exceed them.
- Native decoded AI search cache adapts to the app's heap budget: one thirty-second
  of maximum heap, clamped to 4–24 MiB. The limit appears in Analysis activity.
  Existing foreground-only lifetime, encrypted persistent index, charging/thermal/
  battery gates, incremental analysis and unchanged encrypted recovery-object reuse
  remain in place. No new model, database migration, API or cloud operation was added.

## Verification

- 506 JavaScript/TypeScript unit tests passed. New coverage exercises queue bounds,
  priority, cancellation, coalescing, immediate retry, pixel buckets, collection LRU,
  stale-revision disposal and cursor-only music counts with original-byte preservation.
- TypeScript and targeted ESLint passed. The previously existing unused `audioBlob`
  binding advisory remains in the music backup exporter.
- Gallery workflow and private-library browser suites passed with native fixtures.
  The viewer/pagination check also passed: hidden grids stop decoding thumbnails
  and deliberate near-end paging preserves rapid logical navigation.
- New `GALLERY_CACHE_ONLY=1 node tests/gallery/gallery-browser.mjs` checks deferred
  album reads, pixel-bucket coalescing, retained thumbnails after AI label changes,
  changed-source invalidation and rejection of an obsolete quality request.
- Native test cases were added for adaptive memory budgets, directory-independent
  pruning, burst limits and category-budget consistency. Java formatting/parser
  checks were run; native compilation/tests have deliberately NOT been run.
- No APK, mobile bundle, production build, release, deployment or personal cloud
  operation was run. No originals or cloud objects were deleted or modified.

Phone startup/frame timings, battery use and native storage behavior await device
validation. Cursor-based music counts still visit records in the existing schema;
this reduces retained media objects rather than making an O(1) database query.
Metadata collection caching remains bounded to the active Gallery workspace. It is
not persisted across app sessions, avoiding stale permission-sensitive media lists.
