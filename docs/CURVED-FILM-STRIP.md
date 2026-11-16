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
