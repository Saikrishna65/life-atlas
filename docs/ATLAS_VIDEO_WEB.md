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

## Search autocomplete — 2026-11-27

Typing now opens up to eight YouTube suggestions above the bottom search field.
Requests wait 250 ms after typing pauses. Tap a row to search; its separate arrow
fills the input without searching. Up/Down selects, Enter searches, Right Arrow
fills at the caret's end, and Escape dismisses. Tapping outside dismisses too.
The input exposes combobox/listbox relationships and active-option IDs. Fill
buttons sit outside listbox options so they retain separate accessible labels.

IME composition defers requests until completion. Empty/oversized/control-character
input, URLs anywhere in the text and common raw video IDs do not trigger automatic
completion. Ordinary eleven-letter words remain searches instead of being
mistaken for video IDs; all-letter bare IDs can still be opened with a full video
URL. Prefix changes cancel pending timers/requests and stale responses are ignored.
The panel scrolls independently above a simulated tall mobile keyboard.

The browser sends POST bodies to `/api/video/suggestions`, not query-bearing Atlas
URLs. That stateless endpoint requests YouTube-specific (`ds=yt`) JSON suggestions
from Google's public suggestion service, without SDK/player initialization or
forwarded cookies. Input and response sizes are bounded, results are validated and
deduplicated, and all responses/upstream requests use no-store. JSONP is never
evaluated. There is no query/result cache, logging or new browser storage. Typed
text is received by the suggestion provider; the UI discloses this in You settings
and labels the popup's source. Provider failures quietly hide autocomplete while
normal search remains available.

Validation: 655 unit tests passed, plus TypeScript/scoped lint. New tests cover
normalization, provider request options, bounded/malformed responses and optional
endpoint failure. Browser fixtures at 390px touch and 1280px desktop passed debounce,
selection, fill-only actions, keyboard/ARIA, IME deferral, Escape/outside dismissal,
stale-response rejection, link suppression, failure fallback and absence of stored
history. A short visual viewport checked popup bounds and keyboard scrolling.
Existing browser player/search tests also passed. Screenshots were inspected under
`work/qa-video-web/autocomplete-390.png` and `autocomplete-1280.png`.

Live provider verification was blocked by this environment's network proxy
(CONNECT 403); it was not verified against the live Google service here. Production
availability depends on that service, and typed suggestions are not guaranteed.
No APK/mobile bundle was built. Repeat the browser check with
`node tests/video/autocomplete-browser.mjs`.

## Scroll loading and revised watch layout — 2026-11-27

Search results now use the available screen width, with responsive one-to-five
column layouts and larger thumbnails. The floating search field collapses after
submission so it does not cover the feed. The bottom Search button toggles it
open/closed; closing preserves the active results. Selecting a video opens a
larger player with a related-result sidebar on desktop and a stacked list on
mobile. Closing the player restores the previous result scroll position. Atlas's
external “Open on YouTube” button and its outbound prompt were removed. Links and
branding rendered inside the official YouTube iframe remain provider-controlled.

The old first-page-only implementation is replaced with real provider continuation
pages. The full upstream page is kept rather than truncated to 24 records.
Continuation tokens and anonymous visitor context are returned to the current tab,
then sent back in POST bodies. Each continuation is fetched in one upstream call
without re-running the original search. No query, cursor or result cache/database
was added. Endpoints remain fixed, cursor sizes are bounded and requests remain
no-store. Reloading or replacing the search discards its in-memory state.

An IntersectionObserver prefetches a page near the list end. A synchronous request
lock, cursor identity and generation guards prevent duplicate fetches and late
pages being appended to a replacement query. Results are deduplicated by ID.
Errors preserve already loaded videos and expose Retry; repeated empty pages
pause automatic fetching rather than creating an unbounded request loop. A
manual load action also supports browsers without IntersectionObserver. Repeated
provider cursors terminate pagination. Offscreen thumbnails remain lazy-loaded;
existing result cards are memoized and retain their DOM/image nodes on append.

SDK integration exposed a Search-header constructor incompatibility with
append-only continuation responses. Those pages use the SDK's public generic
Feed parser and command contents, preserving item order without changing the SDK.
Both classic and modern video renderers retain their existing handling.

Validation: 659 unit tests passed, plus TypeScript and scoped lint. The real SDK
with controlled transport kept a 30-item first page, carried visitor context into
a continuation, made exactly one request per page, and deduplicated overlapping
results. Browser fixtures at 390/1280/1920px verified 20→40→50 unique videos from
scrolling, one request per cursor, retry preserving all 40 loaded results,
end detection, replacement-query cancellation, full-width layout, responsive
sidebar, external button removal, Search toggling and scroll restoration.
Existing search/autocomplete browser checks passed. Screenshots are in
`work/qa-video-web/feed-*.png` and `watch-*.png`; their posters/provider pages are
synthetic and iframe playback is blocked in the fixture. Live YouTube pagination
and physical-device behavior were not verified here. No APK was built.

## Discover: explicit topics, no viewing history (2026-11-27)

The bottom navigation now includes Discover. Choose Travel, Science, Technology,
Music, Nature, Design, Cooking or Gaming. One topic is active at a time. Videos
are real provider search results for that topic, not history-based recommendations
or a claim to reproduce YouTube's personalized home algorithm. Topic selection
starts one initial request, followed by the existing paginated search protocol as
visitors scroll. There is no fan-out across every topic and no polling.

Only a validated, fixed topic ID is saved in `atlas-video-topic`; raw queries,
results, selected videos and continuation tokens remain in memory. The existing
appearance preference is unchanged. Forget my topic clears the preference and
current Discover results. You also links to topic selection and explains the
updated storage policy. No Discover provider request occurs before explicit
selection, or while a saved topic's section has not been opened.

Search and Discover own separate result/cursor state. Returning from playback
restores the originating feed's scroll position. Inactive Discover stops observing
its pagination sentinel; interrupted topic requests cannot replace the currently
chosen topic's results. Reopening Discover reuses the tab's current results. A
reload fetches fresh results only when Discover is opened. Request timeouts and
retry are available; topic/feed state does not create an Atlas watch history.

Validation: 660 unit tests, TypeScript and scoped ESLint passed. Search,
autocomplete and pagination source-browser fixtures passed, including existing
390/1280/1920px checks. New Discover browser checks cover 320/390/1280px, explicit
opt-in, pagination, separate search/feed state, player return position, rapid topic
replacement, preference restore/reset and failure/retry. Screenshots are in
`work/qa-video-web/discover-*.png`; images and provider responses are synthetic
fixtures, not live-provider or playback evidence. Direct access to the deployed
Vercel site failed at the environment's outbound CONNECT proxy (403); the connected
web tool also could not access that URL. Live deployment performance and external
playback remain unverified. No APK, mobile bundle or local production build was
created for this change.

## Playback reliability and watch view (2026-11-27)

The no-cookie iframe starts immediately on video selection. In parallel, a shared,
lazy loader fetches the official YouTube IFrame API only when a player is opened.
No SDK dependency, undocumented message parser, playback proxy or background
polling was added. Failed SDK loads clear their pending promise and owned script
so explicit retry can reconnect. An SDK failure leaves the iframe's native
controls available. Provider controls and branding remain intact.

The watch view distinguishes connecting, ready, blocked autoplay, playing, paused,
buffering, finished, slow, offline and error states. Frame readiness is never
reported as playback. Known provider errors explain unavailable/private videos,
owner-disabled embedding and player verification failures. A 15-second startup or
buffering watchdog offers recovery without automatically restarting the video.
Reload player preserves the current position when the provider exposes it; a
changed video starts fresh. Old player callbacks are ignored after disposal.
Timers, network listeners, API player instances and iframe nodes are cleaned up.

Desktop theater view expands the player above the related list. Mobile retains
the compact stacked layout. A back-to-feed button, stable 16:9 related thumbnails,
duration labels and unobtrusive status/retry row keep controls usable. Playback
settings under You control start-on-open (subject to browser autoplay rules) and
related-video visibility. These two boolean preferences are the only new saved
values (`atlas-video-playback`); no video IDs, queries or watch history are saved.

For future live measurements, the player element exposes `data-ready-ms` and
`data-startup-ms` for elapsed time to official API ready / first playing event.
These measurements stay in DOM memory, reset on retry and are not transmitted or
persisted. Provider events do not measure decoded frame quality or ad duration.
There is no claim that provider playback latency has improved without live data.

Validation: 663 unit tests passed; TypeScript and scoped ESLint passed. Source
browser checks at 390/1280px verify lazy/reused SDK loading, failed-script retry,
native iframe fallback, ready-vs-playing states, autoplay blocking, buffering,
provider errors, resume on retry, stale-event isolation, offline recovery,
timeout recovery, cleanup, theater layout and preference behavior. Existing
search, autocomplete, Discover and scrolling/browser checks passed (including
320/390/1280/1920px coverage across suites). Player screenshots are in
`work/qa-video-web/player-*.png`. Responses, SDK events and playback in these
fixtures are synthetic. Live YouTube playback, physical-device behavior and
actual deployment startup latency were not verified. No APK, mobile bundle or
local production build was created. Browsing with a persistent mini-player is
still a separate follow-up; leaving the watch view currently disposes playback.
