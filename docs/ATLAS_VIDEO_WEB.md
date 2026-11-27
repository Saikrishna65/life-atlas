# Atlas Video in a browser

The standalone browser address is `/video` on the Atlas website. After publishing
this code to the Vercel production branch, the configured website address is:

`https://life-atlas-eight-five.vercel.app/video`

Atlas Apps' **Open web player** link uses this standalone page in ordinary browsers.
Native Android and the packaged offline web shell retain `/secret/video`, so the
existing mobile router, shared player and optional authentication behavior stay intact.

The standalone route reuses the browser player without mounting the private
workspace layout. Travel navigation, footer, media-readiness loader and Lenis
wrapper are skipped for this exact route. Other public routes, including the
landing hero/globe, retain their existing behavior. Search is a POST to the
existing `/api/video/search` endpoint; video URLs are parsed locally and opened
only through the allowlisted YouTube embed URL. No R2/LLM credentials are needed.
Only the theme preference is persisted by Atlas Video. Embedded YouTube requests
are subject to YouTube's service availability and privacy rules.

## Why it was missing

On 2026-11-27 the remote `main` was verified at
`29c42b67c7d23cf04fe8ebcd83ac5a11a8abc67e`. That revision did not contain
`src/app/secret/video/page.tsx` or the Video feature. The working branch contained
22 commits beyond it. Local source edits do not update Vercel production.
Publishing therefore needs the Video feature and its dependencies, not just the
new standalone wrapper page. Avoid assuming that this local fix is already live.

## Validation

648 unit tests passed, including route-specific loader exclusion and browser vs.
packaged/native link selection. TypeScript and scoped ESLint passed. A Chromium
source fixture at 390px and 1280px checked direct Video UI access, local YouTube
link parsing, POST search with a fixture response, embed URL allowlisting,
theme-only browser storage and cleared query/player state on reload. External
iframe requests were blocked: real YouTube streaming and live search were not
verified. Screenshots are under `work/qa-video-web/`.

The environment's network proxy blocked the live Vercel inspection, so no live
HTTP success is claimed. No production, mobile bundle or APK build was run. The initial standalone route was published in commit `5979f4e`. Deployment
completion and real playback still require checking the live service.

## Browser redesign and search request reduction — 2026-11-27

The player now has a bottom search dock and compact active navigation pill,
separate discovery/results/player/appearance views, a responsive thumbnail feed,
and a calmer player with related results from the current search. The new default
is Paper; explicitly saved Mono/Paper/Ink preferences remain honored. Search
remains user-submitted, with no background feed requests or search history cache.
Suggestions submit real searches only when chosen. Primary navigation and search
stay at the bottom; the dock adapts to visual-viewport keyboard changes.

Each request previously initialized YouTube's config and JS player before searching.
Search-only sessions now explicitly disable `retrieve_player` and
`retrieve_innertube_config`, and keep `enable_session_cache` false. The real SDK
was exercised with a controlled upstream transport: setup made no network calls,
then exactly one POST search was made. Repeating a search made a fresh request,
confirming that no query/result cache was introduced. Cancellation signals remain
isolated per request. Session and search durations are exposed as numeric
`Server-Timing` headers without recording queries.

The browser allows replacing an in-flight request, suppresses duplicate active
submissions, ignores stale responses, provides cancellation, and bounds waiting
with a client deadline. The server upstream deadline is ten seconds. Direct
YouTube links still open locally without making a search request. Cancelled
searches return to discovery instead of reporting misleading empty results.

Validation: 650 unit tests, TypeScript, scoped ESLint and the browser source
fixture passed. Browser coverage includes mobile/desktop layout, theme-only
storage, direct links, query replacement, stale-response rejection and
cancellation. Desktop/mobile home screenshots were captured and inspected at
`work/qa-video-web/video-home-1280.png` and `video-home-390.png`. The native
packaged-app fixture was updated for the new UI but no mobile bundle/APK was built.
Live upstream latency and real YouTube playback were not measured in this
environment; the one-request result is a controlled SDK integration measurement,
not a claim of instant live search. No APK build was performed.
