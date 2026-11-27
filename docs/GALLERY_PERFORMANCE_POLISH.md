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
