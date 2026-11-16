# The travel journal — trip detail redesign

All `/trips/[slug]` pages now use `TripDetailExperience`, for both public database
journeys and the 24 sample expeditions. This is a new page composition, not an
appearance layer over JourneyStory/JourneyFrame. Other public pages that reuse
the older components are unaffected. The landing hero, globe and archive are
unchanged. The generic public footer is omitted on detail pages because the
journal has its own next-trip ending.

## Composition and interaction

- A full-viewport film/photo cover with masked type entrance and scroll parallax.
- A natural vertical reading flow with one site navigation. The cover retains
  its film pause control and Follow the journey action. Existing Lenis and GSAP
  coordinate motion without a second sticky journal bar or scroll engine.
- A geographic route explorer with fit/street/terrain controls, selectable stops,
  location notes and available recorded metrics. Its Leaflet bundle loads near
  the map; the map height is reserved before loading. Failed tiles leave the
  path and controls available. No WebGL is required for the map.
- A paper-toned itinerary with large day numbers, desktop day navigation, a
  mobile day selector, detailed sample schedules and previous/next controls.
  Changing a day moves its beginning below the main site navigation. Public day
  descriptions are retained without inventing timed activities.
- An asymmetric photo/film journal with place, media-type and category filters,
  empty/reset states and incremental loading. Image titles and location metadata
  appear only in the viewer. Original media opens in the viewer; published image
  thumbnails are used for browsing where supplied by the public catalog.
- Shared accessible modal infrastructure, arrow-key browsing, image zoom, native
  film controls, Escape dismissal and focus restoration.
- A next-trip composition with a scroll-opened image and real navigation. Client
  state is keyed by trip ID so switching trips resets itinerary/filter state.

## Data boundaries

`src/lib/public-trips/detail.ts` adapts existing public web trip records and demo
fixtures into a serializable typed model. No private vault, Android database,
authentication or AI code is read or changed. Catalog items must match the exact
public trip title/slug through the existing `mediaForTrip` selector. Only public
catalog media is merged into the journal.

Recorded GPS segment gaps are preserved by the existing route parser. A real
trip without a GPS track never gets a synthetic line. Unknown metrics, travellers,
dates or itinerary times are not filled with fictional facts. Empty covers use
procedural typography rather than passing off a sample image as a personal photo.
Sample expeditions, imagery, film studies and synthetic routes are labelled.
Coincident rounded demo place centers are distributed along that explicitly
synthetic geometry; they are not verified trail waypoints. Existing assets and
source/license records are reused; no reference-site assets or music are copied.

## Motion and rendering

`DetailFilm` streams native video only when intersecting, pauses when off-screen
or the document is hidden, and respects the film-pause control and reduced motion.
Background films pause while the viewer is open. Explicitly opened films can play
with native controls. No audio autoplays. A blocked autoplay retains the poster.

GSAP contexts/matchMedia, observers and document listeners are cleaned up on
unmount. Reduced motion retains all content without parallax/type animation and
uses static film posters until a film is opened. The approved white navigation
logo gains its existing charcoal surface only while over the light itinerary.

## Validation

- `npx tsx --test tests/public/*.test.ts`: public integrity/preservation and new
  trip adapters (24 sample journeys, missing public data, GPS gaps, optional media).
- `node tests/public/trip-detail-browser.mjs`: Chromium desktop, mobile and reduced
  motion. Tests cover autoplay, maps/controls, stop selection, day navigation,
  place/type filters, empty reset, metadata-on-open, zoom, keyboard navigation,
  focus restoration, next-trip reset and horizontal overflow.
- Scoped ESLint, TypeScript and the production Next.js build.

Browser screenshots are written under `work/qa-trip-detail-v3`. Testing uses local
sample films; it does not constitute physical Android or authenticated R2 testing.

Leaflet controls are isolated within the map stacking context, so they cannot
overlap the main site navigation. The trip browser suite checks actual pointer
hit-testing where the map passes beneath the navbar, as well as bar removal.

## Route overview, irregular frames and cover loading

The map starts from route bounds rather than an unrelated center/zoom. A selected
stop no longer overrides the initial overview. Fit includes space for map controls
and legends; a ResizeObserver refits route mode when its container changes size.
A place is focused only after explicit selection. The browser suite verifies both
route endpoint markers remain inside the map before selection, after fit/reset,
after resizing, and on a longer-distance journey.

Journal frames now alternate pronounced portrait and panoramic aspect ratios
(0.63–1.85), while retaining packed columns and varied small gaps. These are only
preview crops; the viewer continues to show the original image or video.

The film cover uses no substitute poster during normal playback loading. It fades
in the actual decoded first frame. Reduced motion still receives a static poster.
A trip-specific dark loading boundary avoids the former full-screen white spinner
without changing private application loading screens. A delayed-video browser check
confirms no poster/image flashes before the video becomes ready.

## Varied widths and journey figures

Journal previews now vary from 70–100% of a column, with staggered alignment.
Container-relative crop heights preserve the previously approved heights while
widths change; the mobile opening frame remains full width. Original media is
unchanged and remains available in the viewer.

The Way There gives distance travelled and highest altitude prominent positions.
Real journeys show only published totals and valid route metrics; absent primary
figures read “Not recorded.” Available ascent, moving/elapsed time and speeds
appear below. Average moving speed uses the same distance total as the display.
Below-sea-level elevations remain valid. Demo telemetry is a separate fixture and
is explicitly labelled as illustrative, never as personal recordings.

The public data suite covers metric derivation and all 24 sample journeys. The
browser suite checks the figures, example disclosure and actual rendered width
variation at desktop and mobile sizes. A comparison against pre-change frame
measurements verifies that approved preview heights remain unchanged.

## Natural gallery proportions

The gallery now supersedes forced frame crops with each image/video’s intrinsic
aspect ratio. Desktop widths respond to the media proportions with staggered
alignment and modest uneven gaps; equal proportions can share widths. Mobile
uses one full-width column and natural heights. Videos supply dimensions when
metadata is available, retaining lazy native streaming. The browser suite checks
mobile equal widths and loaded photographs’ rendered versus natural proportions.

## Desktop contact sheet

The reference-inspired desktop gallery replaces staggered narrow frames with four
close-set columns, aligned at the top, natural media heights and 12px gutters.
Tablet uses three columns; mobile retains one full-width column. Photos and films
are interleaved deterministically after filtering, preserving order within each
kind and spreading films through the collection. Captions stay in the viewer.

## Flowing gallery reference (16 November)

The supplied recording shows three full-width columns on black, a raised centre
column and independently drifting scroll offsets. `TripJournalGallery` recreates
that treatment with a centre-out entry reveal, tightly spaced native-aspect media
and GSAP scrubbed column motion on the existing Lenis/ScrollTrigger clock. No
pinning or scroll interception is added. Filters rebuild scoped timelines; all
contexts revert on unmount. Mobile remains a static single column; reduced motion
omits the reveal and parallax. Keyboard focus opens the reveal immediately so
clipping never hides a focused gallery control. Photos and films stay interleaved,
with location/captions only in the existing accessible viewer.

The gallery entrance now waits until the gallery top reaches 70% of viewport
height and finishes at 15%. Linear scroll progress keeps the reveal visible
throughout that approach, replacing the earlier 98% trigger and fast-out easing.
The browser regression checks that the reveal remains closed at 85% and starts
opening only after the gallery reaches the intended viewport area.
