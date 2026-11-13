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
