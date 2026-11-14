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
