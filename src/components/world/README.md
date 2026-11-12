# Life Atlas public travel journal

The public homepage now flows from the door hero directly into the Observatory,
Expeditions, Memory Archive, Sound Dimension, optional published collection and
Home Again ending. Arrival, assistant demonstrations and app-system demonstrations
are no longer mounted or included in chapter navigation.

The hero's image controller, scroll duration, frame renderer, assets and entrance
preloader are preserved. The user-authorized editorial update changes heading
markup and introduces `home/HeroEditorial.tsx`; its child transforms animate type
without changing image-sequence progress. Preservation tests pin the original
controller separately from the editable text. All 287 frames remain unchanged.

Expeditions use oversized alternating vertical compositions, links to dedicated
trip routes and scoped image parallax. No pinned horizontal passage is mounted.
Decorative SVG curves draw with scroll, with a moving point following the same
curve. Reduced motion displays completed routes and static text.

`JourneyStory` gives sample trips cinematic covers, actual geographic street/terrain
maps, selectable destination markers, photo lightboxes and itinerary/packing/budget
controls. Samples do not invent travelled paths or telemetry. Published trips draw
their actual GPS segments and show recorded distance, moving/elapsed time, altitude,
ascent and speed. Missing values stay explicitly unavailable. Published photographs
include their linked place names. Map tiles require connectivity and have a visible
failure state. No private local store is read by these pages.

The final doorway starts open and closes as its section reaches the viewport's
bottom, accompanied by return-home copy. Return navigation still uses the shared
Lenis instance. GSAP contexts, triggers and listeners are scoped and cleaned up.

Typed sample records and illustrative image licensing remain unchanged. Published
media continues to use the separate validated, credential-free public catalog.

Checks: `npm test`, `npx tsc --noEmit`, scoped ESLint, `npm run build`, and
`ATLAS_QA_URL=http://localhost:3008 node tests/public/browser.mjs` against a fresh
production server. The browser suite covers the preserved door, scene removal,
globe selection, trip navigation, map controls, field-note controls, closing door,
mobile overflow and reduced motion. Evidence goes into ignored `work/qa-travel`.
