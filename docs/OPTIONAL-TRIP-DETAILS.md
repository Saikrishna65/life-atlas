# Optional public trip content

A public trip journal renders only the sections backed by its published data:

- Route map: a valid recorded segment or a geographic stop. A route without
  named stops uses the full map width, without an empty sidebar.
- Journey figures: only available, valid metrics; zero and below-sea-level
  altitude remain valid. Statistics may appear without a map.
- Itinerary: authored day titles or descriptions. Empty day rows are ignored.
- Introduction: an authored description, without automatically generated copy.
- Frames & films: at least one trip photo/video or matching public catalog item.
  An empty filter result still provides the existing reset control.

The cover uses an available trip photograph when no cover is selected. Missing
hero statistics and zero-stop counts are omitted. The hero button targets the
first available section, section numbering follows visible chapters, and map
code/tiles are not initialized for trips without geographic data. Place filters
are hidden when no place is assigned; type/category controls appear only when
there are alternatives. Missing locations are not shown as “Unassigned” in the
viewer.

Publishing retains absent descriptions as null, skips blank itinerary rows, and
clears removed route data on republish. Existing stored descriptions are not
rewritten. This change does not migrate the database or change the existing
trip-creation requirement for a destination and start date; it removes the
requirement for supplementary public journal content. Local vault, finance,
Android services and the landing page design are unchanged.

## Validation

53 public unit tests, scoped ESLint, and production build including TypeScript.
`tests/public/trip-optional-browser.mjs` exercises the real export endpoint and
public page against an isolated local PostgreSQL server on port 5544:

- Photo-only journals at 1440px and 390px, absent sections, no tile requests,
  scroll targets, lightbox dismissal and no horizontal overflow.
- Adding an itinerary, description, route and one metric; full-width map without
  an empty places column or fabricated metrics.
- Republishing after removing details, plus preserving a real zero metric.
- Empty journal navigation and absent media section.
- Public-catalog-only mixed photos/videos, async readiness and type filters.
- Complete demo journals retain all three sections and seven sample metrics.

The browser test writes synthetic records and refuses non-local databases. Map
responses use local SVG fixtures; no physical-device test is implied. Screenshots
and logs are kept under ignored `work/qa-trip-optional/` and `work/media-only/`.
