# App session loading and navigation

Source-only changes after `3031b02`. No APK/mobile/production build, install, deployment, push, personal-data upload or cloud mutation.

## Audit and implementation

Gallery, Music, Atlas AI and Music layout already use intent-only reusable lazy imports in `mobile/App.tsx`. Those boundaries remain in place. The previous per-consumer Trip Vault hook read the trip list on mount and again for widget synchronization; each mounted consumer repeated both operations.

- Trip Vault consumers now share one external session store/read. Cached records remain visible while a revisit refreshes them. Changes during an in-flight read force a fresh read before publishing the result; failures retain the previous content and expose a fixed safe error.
- Widget synchronization accepts the trip list already read. Existing callers can still request a standalone synchronization. No database schema, original records, authentication policy or cloud transfer policy was changed.
- The trip snapshot is released 30 seconds after its last subscriber closes. Pending results from a cleared session cannot repopulate that session or clear a newer pending request. This cache adds no disk usage or media copies.
- Trip-library query and filter selections survive revisits in process-local memory. UI choices are limited to 32 strings of at most 256 characters; no new localStorage/IndexedDB persistence is used.
- Finance pending-count consumers share a numeric snapshot and one native listener. The ten-second inbox polling loop was removed. Inbox events, explicit finance updates, focus and visibility changes refresh the badge; the parser imports asynchronously. Late events after teardown start no reads. Android's existing plugin emits the `notificationReceived` event used here.
- Trip-finance reconciliation skips starting while the document is hidden. Update-status polling also skips hidden documents; native downloads and scheduled notifications retain their existing behavior.
- Mobile route history now remembers at most 60 scroll positions. Scroll is restored after the real destination commits inside Suspense. A ResizeObserver handles later local content growth for at most three seconds. Touch, pointer, wheel or keyboard input cancels pending restoration. Same-URL Gallery layer history keeps its existing behavior. Back/Forward, same-page navigation and `scroll:false` are supported.

The session caches are derived display state. Mutation functions continue reading authoritative IndexedDB records before changing them. Foreground returns/revisits refresh trip data, and Control Room restore emits the existing vault-change event. No cache entry is treated as a cloud backup or an authority for financial writes.

## Validation

- `npm test`: **529 passed**, zero failures.
- `npx tsc --noEmit`: passed.
- Targeted ESLint: zero errors; two existing raw-`img` warnings on the Trip Vault dashboard remain.
- `node tests/performance/session-browser.mjs`: passed with native/storage fixtures. Three consumers made one initial trip read, one widget update and one inbox read. An idle foreground badge made no further native read over 30 seconds of simulated time. Change events updated every consumer. Cached revisits kept content visible, filters survived remount, late native events were ignored, and an unused trip snapshot expired after 30 seconds.
- `node tests/mobile/navigation-browser.mjs`: passed at 390×844. Tests a delayed lazy screen, delayed local content, Back/Forward, Gallery same-URL layers, `scroll:false`, same-route navigation and user cancellation of pending restoration.
- `node tests/gallery/gallery-browser.mjs`: full Gallery workflow passed with native fixtures, including search, viewing/gestures, collections, publishing controls and bounded large-library rendering.
- `GALLERY_SCROLL_ONLY=1 node tests/gallery/gallery-browser.mjs`: independent Gallery subpage scroll, native Back and cached revisits passed.
- `git diff --check`: passed.

The browser scripts bundle individual source fixtures in memory; they do not package the application. No packaged-app startup fixture was run against an old bundle. Native process startup, Android WebView behavior, battery, real data volumes and physical-device frame rates still require testing when the phone is available. There is no measured phone startup-speed claim for this change.
