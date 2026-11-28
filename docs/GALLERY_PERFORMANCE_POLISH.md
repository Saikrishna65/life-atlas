# Gallery and shared-shell performance pass — 2026-11-27

Thumbnail queue priority is recalculated from live consumers before dispatch.
A cancelled visible consumer no longer promotes another consumer's speculative
request during gestures. Existing deduplication, concurrency limits and hidden
page suspension are retained.

Private-library visible thumbnails load eagerly once their native URL is ready;
nearby ones remain lazy. Image load failures show the media-type fallback rather
than a broken-image tile. No private URLs are added to persistent storage.

The shared app shell's trip/finance bridge now coalesces event bursts with a
120ms scheduler and retains one trailing refresh when events arrive during work.
Disposal cancels scheduled work. Visibility and restoration guards remain in the
refresh operation. This reduces overlapping launch/focus/data-change work and
avoids dropping updates during an active scheduled refresh.

Targeted queue/scheduler tests: 11 passed. A 100-event burst produces one run;
another 100 events during the run produce one follow-up. These are deterministic
scheduling results, not physical-device latency or battery measurements.
TypeScript and scoped lint passed. No APK or production build was performed.
This is a focused first optimization pass, not a claim of completed whole-app
optimization or device-verified gallery animation performance.

## Shared polling follow-up

Gallery analysis/transfer status, cloud transfer monitoring and Intelligence Lab
now use a shared visible-page polling scheduler. It waits for each read to settle
before scheduling another, suspends timers while hidden, refreshes on return and
cleans up on unmount. Native uploads/inference themselves are not paused.
Tests verify zero reads while initially hidden, no overlap during a slow read,
resumption and disposal. This is reduced scheduling work, not measured device
latency. A proposed Music widget timer change was deferred because that component
has existing React lint errors requiring a separate review.

## Music widgets follow-up

The Music widget starts from the existing warm library cache, coalesces library
change bursts and ignores completed reads after unmount. Mix creation uses a
linear Fisher-Yates shuffle instead of a random sort comparator. A 10,000-track
test verifies exactly 9,999 random draws, complete membership and unchanged
library ordering. Sleep timers schedule the deadline instead of polling every
five seconds. The offline-library button performs a real metadata refresh instead
of a simulated verification delay; storage sizes are explicitly estimates.

Validation: 673 unit tests, TypeScript and scoped lint passed. Source browser
fixtures verified that 100 library events produce one extra read, the refresh
button reads the library, the sleep timer pauses after its deadline and cancelling
it prevents that pause. Native music services are mocked; Android background timer
behavior, device battery use and startup latency remain unverified. No APK build.

## Optional cloud startup engine — 2026-11-28

ControlRoomBridge no longer statically imports cloud-vault/client. Its engine is
loaded only when the saved link has ready=true and automatic=true. Enabling the
link during an existing app session loads/starts it; disabling or disconnecting
stops its scheduler. Duplicate notifications share one pending import. Late
imports cannot start after teardown, and subsequent events can retry failed
imports. Settings writes after bridge teardown are ignored.

An esbuild source-only comparison (write:false, ESM splitting, React/Next external,
no minification) against commit 007eca9 measured the bridge's transitive static
chunk graph at 53,691 bytes before and 6,062 bytes after (about 89% less). Entry
chunks alone were 41,537 and 1,991 bytes. The engine moves to a deferred chunk;
these are not Next production sizes, total-app savings or device startup timings.
No APK or production build was created. Lifecycle unit tests cover disabled
startup, 100 duplicate enable events, disable/re-enable, late completion and
failed-load retry. TypeScript and scoped lint passed.
