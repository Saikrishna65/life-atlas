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

## Real stock imagery and precise hover pause

Ribbon sample photos now use documented real Unsplash images stored under
public/images/stock. Sample films are explicitly titled silent pan/zoom animations
of those real photographs, not recorded trip footage. The hero’s assets and
behavior remain unchanged. Pointer-over/out delegates to actual image buttons,
so empty space within the ribbon no longer pauses motion; keyboard focus, the
user pause control, document visibility and modal state retain their behavior.
Browser tests separately verify image-hover pause and empty-space continuation.

Section refinements: removed the small top/bottom editorial rows and divider
lines; the pause control now sits beneath the journal link. Ribbon spacing is
slightly tighter (desktop stride width/7.6, mobile width/4), with a stronger
position-based scale toward the viewport edges. Mobile uses a gentler growth
factor. Sample/source disclosure remains in the viewer and asset provenance.

## Smooth height envelope

Replaced accelerating quadratic growth with a bounded rational envelope and more
closely spaced frames. The centre stays gently scaled, the corners remain larger,
and neighbouring frames have smaller height differences. The pure projection
helper has numerical continuity, monotonic-growth, symmetry and adjacent-size
regression checks; the browser suite also compares actual neighbouring heights.

## Restore original proportions

At the owner's request, the ribbon projection is restored to the exact geometry
from 2dbb0dc, before the larger-corner and smoother-envelope experiments: original
spacing, perspective angles and scale profile. The label cleanup, real licensed
photos, image-only hover pause, background drawing and globe directory removal
are retained. Reference geometry tests cover both desktop and mobile.

Original sizes/tilt are retained, with horizontal positions independently
contracted by 5% on desktop and 2% on mobile to reduce gaps without enlarging
frames or changing the height progression.
