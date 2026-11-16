# Trip Archive: vertical perspective reel

Replaces the earlier staggered cover salon with the supplied recording's central
vertical stack: one front-facing cover and folded perspective planes above and
below, contextual trip title on the left and a working journey link on the right.
The photographic presentation uses CSS 3D transforms, no new WebGL renderer.

A CSS sticky stage sits in a bounded native scroll passage. GSAP ScrollTrigger
scrubs a phase object on the existing Lenis clock; only the active-index boundary
updates React state. Cover height is cached by ResizeObserver, so the frame loop
writes transforms without measuring layout. All observers, timelines and match
media contexts clean up. Only the active cover is focusable; adjacent planes are
visual context. Next/previous and focused arrow keys also move the reel. No wheel
or touch events are intercepted, and scrolling leaves the section normally.

Reduced motion collapses the scroll passage to one static stage and uses direct
previous/next selection. Touch uses a narrower composition with title and actions
below the cover. The supplied white navigation mark gains a dark backplate over
this light section; its artwork is unchanged.

Search, country filtering, sorting, reset and progressive loading remain in the
Find a journey dialog, with links to each full trip page. Only nearby cover images
mount at any time, bounded to seven. Local mock/public trip data remain separate
from the private app. Existing cover provenance and sample labels are retained.
The floating People section, hero, globe and film ribbon are unchanged.

Validation: scoped lint, public unit suite, production build and the archive
browser flow (desktop/mobile/reduced motion) cover transforms, index stepping,
keyboard, search/filter/sort/reset, expansion, dialog dismissal/focus, links,
overflow and runtime errors. Browser screenshots: work/qa-trip-archive/reel-*.
