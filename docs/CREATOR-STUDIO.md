# Creator Studio — public website editing

Open **Private Atlas → Creator Studio**.

**Past trips** creates an archived local trip using just its title. Destination,
departure and return dates are optional; unknown dates are never invented. Save,
then use the shared **Publish / update website** panel to select photos/videos,
write optional public copy and opt into an itinerary or route only when available.
Existing vault trips can be selected for publication without copying their private
notes. Their full details still use Trip Vault's existing editor. Studio-owned
past trips can be edited here; active recordings are protected from these edits.

**Homepage** controls these independent collections:

| Collection | Controls |
| --- | --- |
| People along the way | Up to 8 explicitly selected portraits/group photos, in order |
| My life, collected | Up to 32 selected photos/videos in the film ribbon |
| Hero trips | Up to 3 published journeys, in order |
| My roads & my stories | Up to 100 published journeys; curated order is the default |

Choose **My selection**, search the public library and add/reorder/remove items.
Android also offers **Add from my device**, using the existing native R2 picker,
streaming upload queue, previews and integrity verification. No per-image caption
or title is required. Approve and **Publish section** to apply the draft. Removing
an item changes its section only; it never deletes R2 originals or trip galleries.
An empty curated People/ribbon collection hides that section and its chapter link;
it does not bring stock imagery back. **Use current default** explicitly restores
the existing sample/automatic selection after publication.

Local drafts survive reload/offline use and are excluded from the older automatic
Studio publishing queue. Older entries remain under **Previous Studio entries**
in the Android app. A failed publish retains the draft. Revision checks reject
stale overwrites; refresh the published version only when ready to discard that
local draft. New approved R2 uploads remain available if a subsequent section
update fails. Uploads can be finished/resumed in Cloud Storage before retrying.
No personal cloud writes were performed during development validation.

## Persistence and compatibility

`WebsiteSection` stores public configuration separately from personal vault data.
The additive SQL migration also makes public trip/day dates nullable. No original
rows, routes, telemetry, finance, authentication, encryption keys, cloud backups
or clean-start epochs are reset. Existing dates are not rewritten.

Public rendering only reads settings and preserves existing fallbacks before the
new table exists. Explicit publication initializes the additive schema once per
server instance under a database advisory lock, allowing the deployed app to work
without a separate setup step or new Vercel variables. A database role that cannot
run DDL needs the supplied migration applied by its existing operator:
`prisma/migrations/20261117000100_website_studio/migration.sql`. The migration is
idempotent; normal migration tracking can subsequently record it with the existing
deployment process. No R2 secret credentials are sent to the website.

Each update applies only its section and invalidates the homepage's existing ISR
cache. Public visitors need neither localStorage configuration nor app credentials.
The library reads publication JSON metadata instead of full GPS recordings. It
currently loads the newest 200 trips and 1,000 photo records, plus the available
native public R2 catalog. Search narrows that loaded library. People/ribbon
originals load on demand; existing inline public photographs use cached previews
with a byte-preserving original endpoint. Private vault media is never served by
that endpoint. Legacy inline-photo links depend on their public photo record
remaining available; immutable R2 copies are preferred for new publications.

The existing authentication policy is unchanged. Origin/feature-header checks
protect these mutations against cross-site browser requests; they are not account
authentication and do not reinstate an app lock.

## Validation

- 179 Studio, public and vault unit tests; TypeScript and scoped ESLint (image
  element warnings only).
- Production Next.js build; offline app bundle; Android debug APK 1.4.3/code 10.
- Production Chromium: title-only undated trip → publication, People selection,
  reordering, local draft reload, actual website photo order and lightbox,
  mobile overflow, empty-section navigation, stale-revision conflicts, offline
  drafts, curated hero/archive/ribbon selection and legacy public-photo previews.
- Original photograph bytes and ETag behavior are checked against the public DB
  fixture. Original cloud files and unrelated trip records are preserved.

Tests use an isolated localhost PostgreSQL database, licensed local stock-image
fixtures, local videos and software WebGL. No physical phone or real R2 account
was used. Logs/screenshots are in ignored `work/studio-*` and
`work/qa-creator-studio/`. Android signing identity must match the installed app
for an in-place upgrade; never uninstall to work around a signature mismatch if
the device contains local-only data.
