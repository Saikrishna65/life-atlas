# Full-width globe atmosphere and selection

The legacy public header is replaced by the approved split-pill navigation on
public routes, including /map. The globe renderer spans the viewport width on
desktop and mobile. A deterministic, non-interactive SVG star field extends the
existing Three.js atmosphere behind the entire section without another renderer
or animation loop. Mobile reduces the visible background star count.

The selected place's native globe pillar uses a shared warm highlight material
and a larger scale; the previous pillar returns to its normal appearance. The
initial featured destination is highlighted too. Both materials are disposed
with the existing renderer lifecycle, and the pillar reference map is cleared.
Browser checks inspected real Three.js mesh colors and scales before and after
selection, renderer widths at 1920px/390px, background coverage, public navigation,
and overflow. Build, TypeScript and changed-file lint passed. No physical device
testing or FPS claims are made.

# Approved navigation continuity

The homepage chapter navigation retains the hero’s split rounded pill groups,
centred white Atlas mark, 2px blur and circular search/menu controls. Mobile keeps
the centred mark and touch controls. The globe entry aligns to the viewport top
so the transparent floating header sits over the globe scene. The approved hero
and globe source remain unchanged.

# The world, wide open — globe scene

The Observatory now continues the approved film hero's white typography, Jakarta
Sans and restrained charcoal surfaces. The previous cream map frame, instrument
dial, side notes and budget/statistics panels are replaced by an open globe stage,
large editorial title, floating destination photograph and a four-place browsing
rail. Search, category filters, pagination, keyboard selection, previous/next place
controls and real journey links operate on the existing public demonstration data.

The globe model, country geometry, markers, camera transitions, render lifecycle,
scroll choreography, device quality limits and touch behaviour remain in
the unchanged `src/components/home/InteractiveGlobe.tsx`. Each deferred chapter
now has its own Suspense boundary and keeps its loading placeholder in the flow.
Loading another scene can no longer hide the world and interrupt the existing
globe's mount lifecycle. The optional published-media section is isolated too. The approved hero source
and assets are unchanged. Heavy globe code remains lazy and only activates near
its actual stage, preserving the hero’s initial renderer budget. No new WebGL renderer or scroll engine was added.

The new scene uses scoped `observatory.css`. Its incoming photographs fade after
load, while the existing WorldMotion director handles title and drawn-route
reveals. New decorative transitions are disabled for reduced motion. On mobile,
the title, globe and compact photo panel stack vertically; category selection
becomes a native select and arrows have 44px touch targets. The destination
browser also works when WebGL is unavailable.

Same-page links from the hero now enter through the existing chapter navigator,
preventing a router scroll reset while deferred content loads. Initial chapter
hashes use the same path. Alignment waits for visible targets and defers its
final correction past lazy replacements and animation layout measurements. The chapter navigation switches to a dark surface and
white mark for this scene, becoming visible at the navigation landing offset.
Other public chapters retain their palette. No private/native modules are read.

`observatory-browser.mjs` exercises actual Chromium WebGL rendering, entry from
the hero, search, category filtering, camera selection via the existing props,
place stepping, pagination, keyboard activation, internal section navigation,
mobile touch/reduced motion, and a directory fallback with WebGL disabled.
Synthetic network fixtures supply hero video bytes; no personal uploads occur.
`chapter-loading-browser.mjs` holds the adjacent chapter’s production chunk,
verifying that its placeholder, globe renderer and scroll position remain stable.
The browser checks also observe zero WebGL context requests during the hero
and one canvas in the active globe. These are lifecycle checks, not device FPS
or hardware performance measurements.

---

# Restored discovery cards with public trip photographs

The original overlapping-photo gallery card and illustrated ObservatoryInstrument
are restored. The globe card is an SVG illustration with no WebGL or location
pins. Its link still opens the original, unchanged main interactive globe.

The gallery card selects one photograph per trip, from two different public trip
journals. A bounded server query reads two public database trips with photos;
images are selected by featured status/date with stable tie-breaks. The homepage
revalidates every five minutes. The existing public catalog reader also supplies
newly published expedition photos without rebuilding; thumbnails are preferred,
films and non-trip collections are excluded, and known title/slug aliases resolve
to one trip. Real photos are never padded with fictional sample images. If no
public photos exist, the card uses two distinct, clearly labelled demo trip
images already used by the trip journals. Private/native vaults are not read.

The white logo now uses a white-ink SVG filter: its original light shape is kept,
and dark borders/shadows become transparent. The black public-header asset,
hero video/dissolve implementation, shared surfaces and typography are unchanged.

`hero-gallery.test.ts` covers distinct trips, title/slug aliases, thumbnails,
video exclusion, sample separation and repeated image suppression.
`option1-cards-browser.mjs` checks both card links, public catalog integration,
logo rendering, the main globe, mobile and reduced motion. Public media/network
fixtures are explicitly synthetic; no personal media is uploaded by these tests.

---

# Automatic playback and hero navigation refinement

Automatic transitions now prewarm the next paused video after 1.5s of active
playback, except for reduced motion and data-saving connections. The handoff
starts 1.75s before the 10s presentation boundary (or the actual end of shorter
clips). Incoming clips require decoded data and at least 1.4s of buffered media.
Both videos play during the 1.4s linear dissolve; old sources release after 1.5s.
This addresses the previous end-of-clip freeze before the next request started.
Manual selection, paused browsing, and rapid-selection queuing remain supported.

The right rail links to Photo Gallery, the existing interactive globe, and the
latest public trip (`trips[0]`, independent of the active film). The fourth,
compact Explore link opens the directory. Hero typography is Plus Jakarta Sans;
navbar blur is 2px. A shared translucent background token applies to navigation,
hero buttons and discovery panels. White text and unshaded video remain intact.

`hero-automatic-browser.mjs` checks actual automatic progression without clicking
a selector, preloading readiness, motion overlap before the old clip ends, CSS
blend opacity, shared materials, links, type and mobile/reduced motion. Network
fixtures isolate this check from the blocked stock CDN. `hero-playback.test.ts`
checks overlap time for normal clip lengths and unknown metadata.

---

# White hero and reference panel geometry

The current hero uses white type, white CTA surfaces and neutral charcoal controls.
The full-frame gradient shading layer has been removed on desktop and mobile;
text shadows stay attached to lettering. No cream/peach or brown fills remain in
this hero. The existing video-to-video transition logic is unchanged.

The discovery rail is a three-row grid: 42px label above a 146px journal tile,
a photographic tile spanning both rows, and a 146px story panel spanning the
full width. Original SVG journal and observatory-instrument objects replace the
full-bleed left photograph and circular placeholder. They are decorative;
all four discovery links retain accessible text and real destinations.

Browser checks verify panel alignment, spanning heights, white text, absence of
the shade layer, smooth handoffs, mobile and reduced motion. Screenshots are in
ignored work/qa-hero-white. The remaining public scenes are unchanged this round.

---

# Hero refinement: colour and video handoff

`TripFilmStage` retains a live outgoing video until the incoming decoder paints
its first frame (`requestVideoFrameCallback`, or decoded data + two animation
frames when paused). It then overlaps the actual videos with a 1.2s opacity blend.
The outgoing source is released after the blend. Inactive slots have no source;
there is no poster substitution during transitions. A failed incoming clip leaves
the previous scene visible. Reduced motion removes the blend and starts paused;
explicit playback does not change the motion preference for heading animation.

The hero now uses warm peach, light Manrope typography with controlled two-line
headings, paired pill/arrow controls, individual thumbnail rules and warm discovery
panels. Shading is concentrated behind content; footage has a modest saturation
increase. Three 1080p colour motion studies replace the grayscale fallback. They
remain labeled illustrative animations, and their originals are unchanged.

Browser evidence: `tests/public/hero-transition-browser.mjs` deliberately delays
an incoming response, checks the old video keeps playing, measures intermediate
blend opacity, and verifies source release, pause/menu, mobile and reduced motion.
Stock CDN access remains blocked here; local colour-video fixtures verify decoding
and switching without claiming live CDN playback.

---

# Current hero update

The user supplied a reference recording and explicitly replaced the door-hero
preservation requirement. `TripFilmHero` now mounts on the homepage, replacing
`Hero` and `HomePreloader`. Their original files and frame assets remain archived
unchanged. The globe and below-hero sections are unchanged in this revision.

Hero: full-screen silent video, floating navigation, light lower-left trip title,
three film selectors, right-side discovery panels. Stock videos are illustrative;
source/license information is in docs/HERO-FILMS.md. Persistent decoder slots retain the outgoing video while the incoming
video buffers; only the selected and transitioning clips have sources. Playback stops offscreen, on hidden tabs and in menus. Reduced motion
starts paused. Arrow keys switch slides; the pause button controls the sequence.
Public trips are read with `take: 3` and descending startDate ordering. No private
vault data is read. Sample expeditions are used when no public records exist.

The stock CDN is blocked in this workspace. Its source/download redirects were
verified through web lookup; actual stock playback needs verification on an
unrestricted connection. The explicit offline fallback uses previously credited
local motion studies and labels that state in the hero. No reference-site footage
has been copied.

---

## Prior section implementation notes (hero superseded above)

# Life Atlas public travel edition

The homepage flows from the original door image sequence into the globe,
The Art of Going, expeditions, frames & films, the optional public catalog,
and the home-again closing doorway. No private-app feature presentation or
music section is mounted in the public journey.

## Art direction and preservation

Reference: https://deltacafes.com/en (Bürocratik). Its editorial scale, condensed
typography, photographic storytelling and warm tonal contrasts informed this
Life Atlas adaptation. No source code, proprietary fonts, branding, film or
photography from the reference is included. Oswald is an open-source alternative.
Direct browser access to the reference was blocked in the development environment;
its textual structure and published design capture were available through search.
Exact reference animation timing was not verified.

The hero renderer, preloader, 287 frames and image-scroll controller are unchanged.
Only its editorial stylesheet evolves. Preservation tests pin the original image
controller and renderer. InteractiveGlobe.tsx is unchanged in this revision;
its model, camera, marker selection and rendering remain intact. The surrounding
layout is redesigned. The final doorway still closes as the trip concludes.

`AtlasPassage` uses CSS sticky and GSAP ScrollTrigger on the existing Lenis engine.
The desktop cycle crossfades three editorial scenes with direct chapter controls.
Nonactive scenes are inert and hidden from the accessibility tree. Mobile and
reduced-motion layouts show a readable vertical sequence, with no pinned section.
All triggers and media-query listeners are cleaned up. No new animation loop or
WebGL renderer is introduced. The world’s established route-drawing motion remains.

## Photos and films

MemoryArchive has image-only photo buttons and two optional film previews.
TripPhotoCollection supports optional captions, place and category filters,
photo/film filters, posters and keyboard navigation. Location and caption details
are shown in the viewer. Native video controls manage playback, with no autoplay
or automatic audio. Arrow keys retain seeking behavior while a video is focused.
Video controls are included in the modal focus trap.

Two six-second silent animated landscape studies demonstrate working playback.
They are labeled illustrative animations, never actual trip footage. Their source
and licenses are recorded in src/data/demo/SOURCES.md and public/films/README.txt.
They are around 150 KB each, loaded only on opening their viewers. No compression
or processing is applied to published user media by this public implementation.
Browser codec support determines playback of uploaded formats such as MOV/HEIC;
the user can open the original if a film fails to load.

`usePublicCatalog` loads the existing versioned, validated, credential-free R2
manifest. It accepts the `atlasCatalog` public URL parameter or a previously saved
public source URL. It cancels pending fetches on unmount, limits timeouts and
rechecks on focus at most once every 30 seconds. Local imagery remains available
if the catalog fails. Public catalog data is never treated as private vault data.

For a trip’s published media, choose placement `expedition` and set collection
to its exact public slug or full title. An optional `place:Chopta` tag assigns a
place filter. Exact normalized matches prevent one trip’s media from leaking into
another collection. Both image and video MIME types are accepted. The original
public catalog schema and Android publishing protocol are unchanged. No R2
credentials, backend proxy, environment secret or database migration is added.

The existing dedicated trip pages retain geographic route maps, synthetic sample
route disclosures, real published GPS paths, and detailed day-by-day itineraries.
Demo data never claims to document actual travel. Map tiles need connectivity;
local content and the no-WebGL destination directory remain usable independently.

## Validation

- `npm test`: fixture integrity, hero preservation and public media matching.
- `npx tsc --noEmit`; scoped ESLint for changed public files.
- `npm run build` for the production Next.js output.
- `node tests/public/browser.mjs`: existing travel interaction regressions.
- `node tests/public/cinema-browser.mjs`: chapter cycle, film playback, media
  filters, explicit published-trip association, mobile and reduced motion.

Run browser suites against a fresh production server on port 3008. Set
ATLAS_QA_URL to use another local origin. Evidence is written under ignored
work/qa-travel and work/qa-cinema. Do not build over a running production server’s
.next directory. These are Chromium checks, not physical Android or iOS testing.
