# Places organizer — Atlas Next 1.6.0 (24)

Open **Private Atlas → Photo & video gallery → Places organizer**. Grant full
photo/video access for all accessible local MediaStore items, or keep Android's
selected-photo access. **Find places in my photos** requests original metadata
access, then scans native GPS/capture metadata in batches. No live GPS tracking,
external geocoder, media mutation, or automatic cloud upload is involved.

## Review and organize

- Suggestions use a 200 m default radius, adjustable from 25 m to 5 km. Every
  suggested member lies within that radius of a fixed anchor; neighbouring
  photos cannot chain an entire road into one place. Spatial bins support poles
  and the date line. Existing confirmed places invite nearby additions for review.
- Choose a suggestion, inspect its GPS dots and radius, name it and confirm.
  Move the place pin by tapping the map, entering coordinates, or panning and
  pressing Enter. OpenStreetMap tiles need internet; numeric coordinates and
  local organization remain available offline. Large groups show up to 1,000
  GPS dots while the fit uses all locations.
- All scanned media and Unassigned include files without readable GPS. Select
  them to create a manual place, add to another place, split, or remove. Removed
  items stay unassigned and do not automatically return to the old suggestion.
  Dismissed suggestions also stay available for manual grouping.
- Repeated visits are separated when consecutive capture times are over 36 hours
  apart. Rename visits and choose a particular visit or the entire place for a
  trip. Camera timestamps without offsets use the device timezone; missing
  capture timestamps fall back to library-added dates.
- Bulk moves, merge, rename, and the last five local edits support undo. Undo
  does not delete originals, recent scan metadata, cloud snapshots or published
  website data. Source GPS and manual place pins remain separate.

## Trip and website workflow

Choose or create a trip and **Add/update in trip**. Creation needs a title and
its own main map pin. Existing GPS routes, distance and altitude records are
unchanged. Place selections stream through native registration in supported
batches; repeat assignment does not duplicate selections. The current trip
limit remains 250 public media items; choose a visit for larger collections.

Trip copies are independent. Adding more photos later appends them; removing a
photo from a saved place does not remove an earlier trip copy. Use Creator Studio
to remove previously selected trip media. Creator Studio still handles approved
uploads and the final website publication. No personal cloud objects are changed
by merely confirming a place or adding it to a trip.

- Globe: one explicitly chosen trip pin, with legacy main-pin support.
- Trip detail map: individually published place pins, fitted together with any
  real recorded route. Location clusters never synthesize a travelled route.
- Public place precision: exact chosen pin, approximate (coordinates rounded to
  0.01°), or hidden. Explicitly hiding clears a previously published place pin on
  the next publication. These settings do not scrub EXIF from public original
  files. The existing public-original disclosure remains visible.
- Public per-media manifests retain assigned place tags and stable place IDs.
  The encrypted organization catalog is the recoverable source for current names,
  memberships, original GPS and trip references; originals are never rewritten
  just to rename a place.

## Cloud catalog and reinstall

Configure the private bucket and verify the existing recovery kit first.
**Recovery & cloud catalog → Save encrypted snapshot** fingerprints confirmed
originals with a keyed exact-byte identity, then stores an immutable Tink envelope
under `encrypted/catalog/places/<recovery-key-id>/<timestamp>-<uuid>.atlas`.
Snapshots use create-only writes; there is no shared pointer to race or overwrite.
They contain organization metadata and trip references, not media binaries, local
content URIs, raw SHA-256 file hashes, credentials or unrelated vault records.

After reinstall: restore the same encryption key with its recovery kit in Cloud
Storage, find snapshots, merge one and choose **Reconnect restored photos**.
Reconnection reads accessible originals and matches keyed fingerprints, including
renamed files without GPS. Existing local place names and assignments win merge
conflicts. Unavailable originals remain visible as detached records. Private trip
vault contents are restored separately; trip references are not vault backups.

Snapshots are explicitly requested, not automatic synchronization. Cancellation
stops between native batches/files; completed scan results persist. Android can
stop the app; reopen and scan again to reuse previously read metadata. Exact-file
checks on large videos take time. Metadata-only grouping scans do not hash entire
videos. Cloud-only Google Photos items and app-private files are outside MediaStore
access. RAW/unsupported metadata and inaccessible items remain manually assignable.

## Validation

- TypeScript, scoped ESLint, gallery/studio/R2/public export/signing unit checks.
- Native Java compilation; Robolectric tests exercise actual ExifInterface reads
  against synthetic JPEGs, unchanged originals, capture offsets, video coordinate
  parsing, keyed fingerprints, encrypted snapshots, tamper rejection, immutable
  writes and recovery gating. The signed release pipeline runs both APK variants.
- `node tests/gallery/places-browser.mjs`: real Gallery, IndexedDB and Leaflet UI
  with synthetic native/cloud responses; GPS scan, review, visits, manual no-GPS
  assignment, trip main-pin isolation, repeat assignment, remove/undo, snapshot
  workflow, simulated Gallery reinstall/reconnection, preview and mobile width.
- Existing `gallery-browser.mjs` regression flow remains applicable.
- Browser evidence: ignored `work/qa-places/places-desktop.png` and
  `places-mobile.png`. Test map tiles are fixture images, not geographic evidence.
- No physical-device validation and no personal cloud uploads during testing.
