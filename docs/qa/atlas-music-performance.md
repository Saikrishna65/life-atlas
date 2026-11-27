# Atlas Music performance and product naming

Implemented 2026-11-27. Source changes only; app builds remain paused.

## Music changes

- The playback clock now has its own external store. Library rows, navigation,
  queues and shared player controls do not subscribe to time updates. Progress
  displays subscribe separately; hidden mini-player/modal progress unsubscribes.
- Browser MediaSession metadata is updated when track/playback metadata changes,
  rather than recreated on every time update. Playing-position anchors refresh
  at the existing five-second native synchronization cadence.
- Parallel library reads share one IndexedDB scan. A 30-second session cache
  supports warm navigation and seeds Home/Library immediately on a return visit.
  Each caller receives independent row/array copies; immutable Blob references
  are reused without reading whole audio files into JavaScript buffers.
- Writes invalidate the cache only after transaction completion. Writes racing
  pending scans cannot repopulate it with old results. Close, deletion, library
  change events, timeout and backgrounding discard the cache.
- Song saves now resolve on transaction commit and reject on abort.
- File import parsing and cloud action helpers load when requested. No new package,
  background polling service, audio transformation or storage schema was added.
- Newer playback selections invalidate older asynchronous requests. Stop/unmount
  also cancel pending playback state updates, avoiding stale errors or resumption.
- Track-action sheets reset by selected track identity rather than synchronous
  effect resets. An unused sheet helper was removed. Sleep-label updates occur
  from user actions/timer ticks rather than immediate effect state changes.

## Product names

The main product is **Atlas**. Modules use **Atlas Music**, **Atlas Gallery**,
**Atlas Video**, **Atlas Finance** and **Atlas Trips**. Updated active website/app
copy, metadata, accessible labels, voice replies, notifications, exports' display
names, documentation and matching test descriptions. Music's Vault tab is Settings.
The npm workspace package name is `atlas`.

Compatibility identifiers deliberately remain unchanged: Android application IDs
and Java/Kotlin package paths, database/storage keys, existing object/bucket keys,
deployed URLs, event names, backup formats and legacy bridge/voice aliases.
Existing installed clients' user-agent marker is still accepted; new builds use
`AtlasApp/1.0`. Renaming these persistent identifiers without migration could
strand local data, cloud references or installed-app updates. No cloud data was
removed and no installed-app identity was changed.

## Validation

- 641 unit tests passed, including cache concurrency, expiry, invalidation, failed
  read recovery, exact original audio bytes and the playback clock subscription.
- TypeScript and scoped ESLint passed, including functional Music changes.
- Chromium source fixture: 30 progress updates with 100 library rows produced
  **zero extra library-row renders**. Rapid playback switching and Stop during a
  pending playback promise passed, with no page errors.
- IndexedDB fixture: seven library readers used **one database scan**. A subsequent
  committed update produced a fresh scan and preserved exact original bytes.
- Changed Android manifest/resource XML was parsed. Full Android compilation and
  physical-device testing were not performed. No APK, mobile app bundle or
  production build was run; no push/deploy was performed.

These measurements isolate the affected source paths. They do not establish
phone cold-start time, real audio decoder behavior, battery usage or total app
bundle size. Validate those on the repaired phone before claiming device gains.

Repeat source checks with `npm test`, `npx --no-install tsc --noEmit` and
`node tests/music/playback-browser.mjs`.
