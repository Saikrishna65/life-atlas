# Trip → website publishing and GPS corrections

## In the app

Open Trip Vault → a trip → **Publish / update website**. The same panel is available
in Memories. The title is prefilled. Select saved photos, pick original photos/videos
through Android's document picker, or choose already-public R2 media. A public
introduction and a batch place name are optional. No per-photo title, caption,
itinerary or recorded route is required. Existing travel dates are reused; if the
trip is undated, a selected memory's recorded date is used. An entirely undated
trip still needs a real date in its trip/memory record because the existing public
DB requires one; this release does not fabricate one or migrate that schema.

Choose itinerary and recorded-route sharing separately, review the disclosure,
and approve publishing. Original native files go directly to the configured public
R2 bucket; the existing uploader verifies them before publishing catalog entries.
No R2 credentials pass through the public API. Small local vault photos can use
the existing JSON export; a 3 MiB request limit directs larger originals to R2.

Trip metadata, photo indexes and video metadata are committed in one database
transaction. Stable trip slugs use the local trip ID to avoid merging same-title
journeys. Public videos are stored in the trip's publication metadata, so a fresh
visitor needs no browser-specific catalog setting. They also feed latest-trip hero
films and the homepage ribbon without changing their existing motion/design.

Only selected memories and explicitly authored public copy are exported. Private
trip notes, saved-memory titles/captions, finance records, tickets and contacts are excluded. Public originals
may retain EXIF/location metadata; use sanitized copies when needed. Route sharing
makes its recorded coordinates public. There is no automatic/private-media upload.

## Preservation

Existing local trip records and cloud backups are never reset or deleted by this
feature. The data-clean epoch is unchanged. Keeping route sharing off preserves
existing website route data, distance and altitude; omitting itinerary/media keeps
those existing collections. Explicitly choosing replacement media updates that
journal collection. Failed metadata writes roll back rather than clearing the
previous journal. An upload approved by the user may already have a public R2 URL
if the subsequent metadata update fails; the UI explains how to retry. No automatic
cleanup deletes these objects. Native transfers can be resumed in Cloud Storage.

Publication stamps and live recordings use narrow, atomic IndexedDB patches so
neither can overwrite the other's fields. No live personal cloud writes were used
for verification; browser integration uses an isolated local database.

## GPS changes

- Geolocation speed is converted from m/s to km/h once at the boundary. Stored
  breadcrumb speeds remain km/h.
- Reject invalid/duplicate/out-of-order fixes, poor horizontal accuracy, stationary
  jitter and positional speeds incompatible with the selected travel mode.
- Reject implausible sensor speed and use valid geographic displacement instead;
  do not clamp a 600 km/h spike into a plausible record.
- Keep full distance precision; format only for display.
- Use actual timestamp intervals for moving time and wall-clock intervals for
  delayed stopwatch callbacks, rather than adding a fixed three seconds per fix.
- Pauses and lost GPS signals create separate route segments without inventing
  distance across the gap. Public maps and GeoJSON respect those gaps.
- GPS altitude requires usable vertical accuracy, rejects abrupt spikes, smooths
  closely spaced readings and applies a deadband to ascent. Zero and negative
  altitudes are valid. GPS altitude remains approximate, not a surveyed/barometric
  or guaranteed mean-sea-level height.
- One controller per open trip prevents duplicate watchers across tab changes.
  Android's service buffers up to 20,000 accepted fixes in memory; the controller
  consumes them in timestamp order with vertical-accuracy metadata. This improves
  continuity while the app process lives; it is not process-death recovery. If
  Android kills the process, unconsumed buffer points may be lost. The app pauses
  interrupted recordings safely instead of inventing the missing route/time.
- Starting over cannot silently erase a trip's existing recording. Previously
  incorrect historical totals/maxima remain untouched; they are not automatically
  recalculated or rewritten in the cloud. Review old figures before publishing.

The existing app/account authentication policy is unchanged. The export endpoint
now uses the project's feature-header/origin checks, which are CSRF controls and
are not account authentication. This release does not reinstate an app lock.

## Validation and build

173 vault/public unit tests cover conversion, jitter, spikes, route gaps, precision,
altitude quality, historical preservation, explicit publication selection and
concurrent storage updates. Four native JUnit GPS tests exercise the Java filter.
Scoped ESLint reports existing/private `<img>` and hook warnings, with no errors.
Production Next/TypeScript and offline mobile bundles are checked. Android debug
APK version 1.4.2 (code 9) is built after Capacitor asset copy.

Production Chromium exercises the actual private review UI and export endpoint
against isolated PostgreSQL, preserved existing website telemetry, public video
visibility, one watcher across tabs, realistic walking fixes, mobile layout, and
existing trip/hero regressions. Stock video/map requests use local fixtures.

No physical phone, real R2 account or personal upload was used. A full pre-existing
Robolectric suite initially could not write its runtime lock under the sandbox's
read-only home; the four new native GPS tests run independently and pass. Device
GPS, battery/background behavior, provider-specific accuracy and real R2 credentials
still need verification on the target phone. Do not uninstall an existing app to
work around a signing-key mismatch: use its original signing key to preserve data.

Artifacts/logs: ignored `work/qa-trip-publishing/`, `work/trip-*`.
