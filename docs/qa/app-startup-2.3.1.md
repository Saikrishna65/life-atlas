# Atlas 2.3.1: startup and local-screen performance

## Changes

- Render the bundled app before importing legacy Studio publishing or running
  maintenance. Publishing listeners and retries continue after a two-second delay.
- Stop deleting all CacheStorage on each launch. A one-time, nonblocking migration
  unregisters only this origin's historical `/sw.js`; user caches, databases,
  credentials and media remain untouched. The migration retries after errors.
- Remove the workspace epoch loading gate: its historical migration is a no-op.
- Use the compiler's aggregate stylesheet once. Metadata confirms coverage of
  lazy-entry CSS sources before skipping their duplicate copies. A shared runtime
  loads additional styles before a lazy entry resolves if future output changes;
  concurrent requests deduplicate and failed loads can retry.
- Split music layout, trip frame, legacy Studio list, Now Playing and YouTube import
  UI from the opening dependency graph. Keep global playback/voice listeners.
  Once opened, the music overlays retain their mounted state, including sleep timer.
- Read voice preferences through a small module; load conversation planning and its
  finance adapters on the first command instead of on every app opening. No voice
  permissions, consent checks, key storage or action authorization were changed.
- Warm only the intended local screen on pointer, keyboard focus or touch intent.
  Do not preload images, videos, optional models or all screens. Failed prefetches
  do not prevent a later navigation attempt.
- Start initial Gallery media reads without the old 120 ms delay. File-name typing
  retains debouncing; smart-search debouncing and cancellation remain in place.
- Existing update identity is retained; version 2.3.1 / code 47.

## Resource measurements

Same workspace, production esbuild, raw bytes (not network compression):

| Opening resource | Before | After |
| --- | ---: | ---: |
| Initial CSS requests | 24 | 1 |
| CSS loaded at opening | 1,907,131 B | 506,863 B |
| JS static closure for boot, app and home | 718,791 B | 542,034 B |

CSS reduction is 73.4%; opening JavaScript reduction is 24.6%.
Optional modules remain bundled for offline availability. Overall APK size is a
separate measure; these figures do not claim battery savings or phone frame times.
Build output `asset-report.json` records the resource graph and startup summary.

## Validation approach

`tests/mobile/startup-browser.mjs` runs the actual packaged mobile output in
Chromium at a 390×844 viewport, blocks external network requests and deliberately
stalls obsolete-worker enumeration. It verifies that the home screen still opens,
local storage is retained, Gallery/music/trip navigation works, styles do not load
twice, a failed optional stylesheet can retry, and there are no page exceptions or
horizontal overflow. Evidence is under ignored `work/qa-startup/`.

Unit coverage checks one-time worker migration, preservation of caches and unrelated
workers, reusable prefetch/retry, CSS coverage and graph accounting. Existing Gallery
browser coverage checks local/public/private workflows, consent and viewer cleanup.

No private cloud reads, uploads, restores or deletion were performed. No models,
network services or dependencies were added. The user's phone is being repaired;
physical Android startup, touch/frame performance and battery behavior remain untested.

## Completed local checks

- TypeScript and targeted ESLint passed (legacy Studio image markup retains the
  existing Next image advisory; no new lint errors).
- 499 JavaScript/TypeScript unit tests passed; 10 signing/update/asset checks passed.
- Production Next.js build, offline mobile build and Capacitor sync passed.
- Actual packaged mobile browser flow passed: one stylesheet on home and Gallery,
  music and trip layouts usable, optional-style failure/retry handled.
- Existing Gallery workflow, analysis-health and app-update browser suites passed
  with native fixtures. Browser screenshots were captured and inspected.
- Native source changes are limited to version metadata. Native suites and signed
  APK validation will also run in the install-update CI job; no live cloud job.

## Signed release verification

- Application source: `bcf81c0ec9797d8bd9ddc1ca09984028fbbbc561`.
- [CI run 45117026485](https://github.com/Saikrishna65/life-atlas/actions/runs/45117026485)
  succeeded. Install-update job 137502087288 ran the debug and preview native test
  suites, built both APKs, and verified update compatibility. Live personal-cloud
  job 137502088976 was skipped.
- [Atlas 2.3.1 APK](https://github.com/Saikrishna65/life-atlas/releases/download/atlas-install-update-45117026485/atlas.apk)
  is package `com.lifeatlas.app.next`, version code 47.
- Downloaded APK size: 74,381,025 bytes. SHA-256:
  `394a986e60a21e1bc00e43e61193e2a9ccd00b7ca031158c6801bebe4bc4c0be`.
- Preserved signer SHA-256:
  `2f19571f9d6a4a3b4c7250397b7618f04e047beeeaa0023713e2a6c0a745af7d`.
- Verified the downloaded public APK locally with apksigner and aapt. Manifest
  package, version, size and checksum match. Install over Atlas; do not uninstall.
  APK size increased by 41,106 bytes from 2.3.0; startup resource savings do not
  imply a smaller overall APK. No new model or dependency was introduced.
- Physical Android timing, frame pacing and battery consumption remain unverified
  while the user's phone is at repair.
