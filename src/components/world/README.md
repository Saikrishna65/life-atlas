# The Living World public experience

The homepage retains `home/Hero.tsx`, its frame renderer, preloader, secret-door
hotspot, assets, timeline, and sticky scroll length unchanged. `LivingWorld`
begins immediately after it, holding the original final frame at the same cover
scale. Shared styles and motion are scoped to the new public experience.

## Composition and data

Arrival is light and immediately available. Seven optional chapter modules are
loaded when approached or explicitly requested. WebGL initializes near its scene;
the globe and orb suspend rendering offscreen. Large optional memory, music,
conversation, finance, and planning fixtures live in separate chunks. The original
hero's existing Next Link prefetch behavior can prefetch the public travel module.

`data/demo` is public, deterministic fiction. No private store or live assistant
module is imported. `destinations.ts` supplies geographic seed records;
`expeditions.ts` exports the linked destination view, complete journeys, timeline,
and milestones. Memory vignettes and timeline chapter beats are separately authored.
Selectors handle search and derived statistics. Money uses integer paise.

The 180 gallery metadata records intentionally reference six illustrative studies;
they are not 180 documentary photographs. Sources and license notices accompany
those assets. Geographic center cross-checks are recorded separately and are not
navigation waypoints. Music artists, albums, tracks, and durations are fictional.
There is no audio, fake player, model API, or notification execution.

## Navigation, motion, and resources

Use the existing root Lenis instance. `navigateChapter` waits for a deferred
chapter to mount, remeasures Lenis, and aligns after intervening content loads.
It ignores obsolete navigation requests. New ScrollTriggers refresh safely and
respect reduced motion. All observers, timelines, timers, listeners, and GPU
resources have scoped cleanup. Scene errors retain a route to the public directory.

Native dialogs stop Lenis, wrap keyboard focus, close on Escape or backdrop click,
and restore focus without scrolling the underlying page. Memory arrows work from
the keyboard. Detail links close their overlay before navigating.

The original globe model, material palette, rendering layers, initial point-of-view
calculation, rotation controls, and scale timeline remain in use. Additions are
selectable geographic points, an external destination directory, optional camera
focus, bounded DPR, offscreen suspension, and lifecycle fixes. The touch canvas
uses `pan-y`: browser testing verified the prior OrbitControls `none` setting
prevented vertical page gestures even when touch rotation was disabled.

Public indexes and demo details are database-independent. Unknown existing trip
and place slugs continue to use their original public queries and content within
the new shell. The sitemap includes available public database entries and remains
buildable without that optional database. Private routes and native integrations
are outside this redesign.

## Checks

From the repository root:

- `npx tsc --noEmit`
- `npm test` (includes the public integrity and preservation tests)
- `npm run build`
- `ATLAS_QA_URL=http://localhost:3001 node tests/public/browser.mjs`

The browser suite needs Playwright and Chromium. Both were available in the
provided managed runtime; no application dependency was added. Override
`ATLAS_CHROMIUM` when the browser executable differs. Evidence is written to the
ignored `work/qa` folder. The suite covers the door, scene transitions, interactive
content, native dialog focus, public routes, real touch swipes, desktop, mobile,
orientation changes, small screens, reduced motion, and WebGL failure.

Repository-wide ESLint currently reports errors in untouched legacy modules.
Changed public files are checked separately; this task does not alter private
code to address those unrelated findings. Browser emulation is not physical
Android-device, cross-browser, or Lighthouse validation.
