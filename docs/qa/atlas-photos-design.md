# Atlas Photos — Gallery redesign, 1.7.0 (26)

The private Gallery now follows familiar photo-library conventions rather than
an editorial landing-page layout. The large hero, decorative orbit and dense
always-visible filter panel have been removed. Atlas retains its own identity.

- Light canvas, system typography, muted blue accents and compact rounded controls.
- Persistent filename search, desktop navigation rail, tablet compact rail and
  phone bottom navigation. Insets account for display cutouts and system areas.
- Date-grouped, justified rows with narrow gutters, original aspect-ratio hints
  and non-stretched final rows. Dates retain the existing library date semantics.
  Name/size sorting disables date headings. Density and pinch controls remain.
- Date selection toggles groups without losing other days, up to the existing
  100-file selection limit. Long press starts selection; tapping another photo
  extends it. Keyboard controls and shift-range checkboxes remain supported.
- Images lead the grid; filenames and detailed cloud state live in Details.
  Video durations, hover/focus affordances and selection states remain available.
- Full-screen dark library viewer with swipe, keyboard navigation, zoom, real
  video controls and a details action. Favorites remain available in Details.
  The public trip viewer keeps its original variant.
- Media-type/favorite quick filters; album, cloud, ordering, date and density
  controls under Filters. Public/private cloud browsing, transfer actions,
  trip assignment, publishing and cover selection retain their existing behavior.
- Places uses the same light workspace: compact scan/recovery controls, GPS
  review, manual grouping, visits, split/merge/undo and encrypted snapshots.
  Filename search is shared with the Places review filter.

The row layout and date headers share windowed geometry for large collections.
Only nearby rows are rendered for large lists; native thumbnails remain lazy
and concurrency-limited. The grid measures its real width before rendering and
reattaches its observers when changing views. No new rendering loop, media
transcoding, credential handling or original-file mutation was introduced.

Validation includes TypeScript, scoped ESLint, gallery row/group geometry tests,
existing gallery/studio/R2 checks, real browser interactions with fixture native
responses, mobile/desktop screenshots, production/mobile builds and the signed
Android pipeline. Browser tests cover date selection, tap-to-select, viewer
Details, touch/swipe, cloud isolation, upload/publication, queue controls, large
libraries, Places organization, snapshot/reconnection and responsive overflow.

Screenshots: ignored `work/qa-gallery/gallery-desktop.png`,
`gallery-mobile-initial.png`, and `work/qa-places/places-mobile.png`. These use
synthetic records and repository assets, not personal cloud data. Physical-phone
validation is still required; no device testing is claimed.
