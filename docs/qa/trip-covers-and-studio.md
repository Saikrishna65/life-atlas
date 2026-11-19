# Trip covers and Creator Studio

Creator Studio → Past trips → choose a journey → Cover frame. Select an uploaded
photo or video, preview desktop/mobile framing, and press **Update website cover**.
A local choice is saved immediately. Newly uploaded media must be included in the
trip's normal publication before a cover-only update can select it. Automatic
selection restores the existing first-video/available-photo behavior.

The existing export API has a metadata-only `trip-cover` action. Its public media
ID must belong to that published trip; arbitrary URLs cannot be submitted as a
cover. An advisory transaction lock serializes it with full trip publication.
Only `coverImage` and `routeData.publication.hero` change; routes, totals, child
records, native selections and upload jobs are not replaced. Existing trips need
no schema migration. Public trip pages and homepage trip previews honor explicit
photo choices even when videos exist. Original media bytes remain unchanged.

Studio now has a forest-colored masthead, real local counts, searchable thumbnail
journeys, collapsible trip details, direct workflow navigation, place-filtered
cover choices and responsive previews. Existing place/media publishing and
homepage curation controls remain available.

## Validation

- TypeScript and scoped ESLint; production Next.js build using an isolated dummy
  database URL. No live production database or personal R2 files used for checks.
- 95 public/studio/R2/website-payload unit tests, plus 5 APK compatibility tests.
  Cover tests check photo/video priority, invalid cross-trip choices, safe URLs,
  metadata-only writes, unchanged route/media records and local persistence.
- `node tests/studio/cover-browser.mjs`: actual Studio components, Chromium,
  browser IndexedDB and synthetic API/media fixtures. Tests cover selection,
  reload persistence, cover-only request contents, automatic reset, keyboard
  selection, place filters, search, 1440px/390px layouts and console errors.
- Browser screenshots under ignored `work/qa-trip-cover/`: Studio masthead,
  desktop cover editor and mobile editor. Photography/video are existing repo
  assets used only in this isolated test fixture.
- `npm run build:mobile` and `npx cap sync android`.

Android installation, real user bucket updates and physical-device rendering
must be checked on the phone; browser tests do not establish those results.
