# The people along the way

A separate deferred public section between the curved ribbon and trip archive.
Eight intentionally curated, real stock sample photographs replace random selection.
Desktop uses a floating composition with scroll-linked outer frames; mobile uses
a staggered two-column layout and a wider group photograph without overlaps.
Reduced motion omits parallax and hover transitions. The existing modal manages
Escape, focus trapping/restoration and Lenis while custom arrow navigation wraps
through the selected collection. Captions/context appear only in the viewer.

`src/data/demo/people.ts` defines the typed public `PeoplePhoto` contract and
explicit ordering. `PeopleMoments` accepts this collection as a prop. This is a
future integration point only: no private app controls, publishing integration,
private media reads, vault access or automatic trip-photo selection were added.

The sample assets are local WebP files; provenance is documented under
`public/images/people/README.md`. Section and viewer disclose that these are
stock examples, not the owner's personal travel photos. Replace them
with explicitly approved public selections when app publishing is implemented.

Validation: scoped lint, production build/TypeScript, public unit tests, and the
people browser flow at 1440, 390 and 320px/reduced motion. Browser evidence is
saved under `work/qa-people` and checks section order, asset loading, viewer,
keyboard wrap, Escape, focus restoration, overflow and runtime errors.

The former generated assets have been replaced with real Unsplash photographs
from a documented licensed asset mirror. Direct original image URLs, mirror
commit and the free-use license are retained in /images/people/README.md.
The section’s organic SVG line draws progressively with ScrollTrigger on desktop
and mobile. Reduced motion shows the full line statically. No new scroll engine
or private app integration was added.
