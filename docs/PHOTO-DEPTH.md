# Through the lens

A new public chapter between the unchanged trip-film hero and original globe.
No private app code or storage is involved.

The scene uses real CSS 3D transforms and perspective: 27 image planes in three
layers with individual orientations and a coordinated camera rotation. GSAP
ScrollTrigger drives a single deterministic progress value using the existing
Lenis integration. The entrance begins with three photographs, reveals the wider
field, moves through its depth, then settles on one image. Scroll reverses it.
The desktop passage occupies 340 small viewport heights; mobile uses 240 with
only 18 visible planes and gentler camera rotation. Sticky framing uses native
CSS, with no wheel interception or second scroll engine.

The chapter/code is deferred through the existing loader. Its reserved height
matches its loaded layout; below-fold image variants are lazy loaded. Rendering
occurs on scroll, pointer easing, and resize; there is no permanent rendering
loop, canvas, new Three.js renderer, or manually managed GPU textures. Timelines,
observers, listeners, and pointer tweens are disposed on unmount.

Published public trip photos are preferred, deduplicated and capped at 24 sources.
The empty-data fallback reuses seven real licensed local landscape photographs;
provenance is in `public/images/stock/README.md` and `src/data/demo/SOURCES.md`.
Photos repeat at different depths when there are few sources, matching the
reference's repeated spatial field. Samples are identified inside the viewer,
without captions over the scene. Remote originals bypass the Next image proxy
so explicitly public R2 URLs need no new secrets or server configuration.

Each image is a named button opening the existing accessible dialog, which stops
Lenis and supports Escape, arrow keys, next/previous controls and focus restoration.
A focus-visible skip link continues to the globe. Reduced motion presents a
compact static gallery of unique sources instead of the scroll passage. CSS 3D
unsupported browsers receive a flat image layout. Images remain DOM content;
WebGL is never required.

## Validation

Production build and scoped ESLint pass. All 50 public unit tests pass, including
selection integrity and 5,454 sampled desktop/mobile poses. Chromium checks cover
five scroll positions at 1440px and 390px widths, reverse scrolling, full-screen
sticky framing, original-image loading, modal arrow/Escape keys, horizontal
overflow, and page errors. A separate reduced-motion run checks the compact,
deduplicated gallery and keyboard dismissal. Hero responsiveness passed at 14
viewport sizes. Browser evidence is saved under `work/qa-photo-depth/`.

The scene-specific production chunk is 9,596 bytes raw / 3,837 bytes gzip in this
build, excluding existing shared GSAP, React and image libraries. This is a bundle
measurement, not a frame-rate or physical Android performance claim.
