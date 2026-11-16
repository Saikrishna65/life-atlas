# Landing film ribbon

The supplied image is interpreted as a single inward-curving ribbon: small
central portrait windows, larger tilted edge frames, rounded corners and a
continuous stream of mixed published/sample photos and silent films. The existing
landing palette and surrounding scrapbook composition remain intact.

A single requestAnimationFrame projects each card from its position on the
ribbon. The phase wraps without changing the media selection; dimensions are
cached by ResizeObserver. No layout reads occur inside the animation loop.
IntersectionObserver, page visibility, user pause, hover/focus and the open viewer
stop the loop. Observers, event handlers and animation frames are cleaned up.
Reduced motion switches to a native horizontally scrollable strip; repeated fill
cards are inert and hidden from accessibility. The existing film observer loads
only intersecting videos and pauses hidden/offscreen playback.

Validation: production build/TypeScript, scoped lint, public unit suite, and
scrapbook Chromium tests at 1440, 390 and 320px (reduced motion). Browser checks
include perspective scale variation, movement, hover pause, viewer navigation,
film playback, overflow and page errors. Screenshots: work/qa-scrapbook/ribbon-*.

## Composition revision from the follow-up recording

The ribbon is now introduced by its heading, short description and journal link,
matching the hierarchy of the image reference. The duplicated floating-print
collage, SVG route and fixed 1250–1800px stage have been removed. A compact closing
note follows the ribbon, so the section has one media presentation and no empty
collage canvas. The existing random selection, autoplay/pause, modal, keyboard
navigation and sample labels remain. Browser coverage checks heading-before-strip
DOM order, absence of the old stage, projection/motion, user pause, photo-to-film
viewer browsing and focus restoration on desktop/mobile/reduced motion.
