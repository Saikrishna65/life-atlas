# Atlas photo library — 2.0.0

Open **Private Atlas → Photo & video gallery → Backup**. Choose the relevant tool from the backup workspace.
The native route is `/secret/gallery/library`. These tools do not change the
public website's hero, globe, trip journal, or publishing approval workflow.

## Setup and private backup

1. In Control Room → Cloud Storage configure/test the **private** bucket.
2. Create/export the independently recoverable Tink recovery kit. Save it outside
   the phone, and complete the existing restore-verification step.
3. In Gallery allow full photo/video access for the media types to be backed up.
   Android's selected-photos permission still works for manual Gallery browsing;
   unattended backup requires full access. Original metadata access is requested
   when enabling backup so encrypted originals retain their original bytes.
4. In Backup → Manage private backup choose albums, photos/videos, network, charging,
   existing-file policy, and optional short video previews. Check approval and
   save with native device authentication. Defaults: disabled, unmetered only,
   original photos/videos, previews disabled.
5. Scan now requests discovery; hourly WorkManager discovery continues when the
   application isn't open. Android constraints, battery restrictions, foreground
   service limits, force-stop, device reboot and OS scheduling affect timing.
   This is not an uninterrupted-upload guarantee or an instant camera observer.

Native content-URI reads, multipart staging, authenticated Tink encryption and
SHA-256 download verification reuse the existing R2 transfer pipeline. Originals
are never resized or re-encoded. Automatic uploads use their own serial chain so
an automatic unmetered/charging constraint does not hold up manual trip uploads.
Failed transfers remain visible in Cloud Storage; re-saving enabled settings can
requeue paused/failed/interrupted automatic jobs with unchanged credentials.
Disabling backup pauses automatic work; local and cloud originals remain.
Previously approved queued files remain approved if the selected albums change.
No public upload or website publication is authorized by enabling private backup.

## Recoverable encrypted index

A Keystore-sealed SQLite index lives in Android's no-backup directory. Filenames,
object keys, plaintext hashes and imported metadata are encrypted at rest; SQL
lookup columns contain opaque IDs/HMAC fingerprints. Native JS summaries never
expose credentials, original hashes, source URIs or private object paths.

After binary verification a private upload commits an independently encrypted,
append-only record under:

`encrypted/catalog/library/<recovery-key-id>/<content-record-id>/<clock>-<revision>.atlas`

Records retain original names, MIME/size, checksums, preview references and state.
Conditional create-only writes and authenticated read-back prevent overwriting
existing recovery records. A retry verifies an existing immutable revision.
Local dirty records can be synced later; verified media is not uploaded again
when only its index commit needs retrying. Completed automatic jobs leave the
bounded transfer journal only after the cloud index is durable.

After reinstall/device replacement restore the same recovery kit and bucket,
then choose **Restore index from R2**. This reconstructs the library and cloud
trash, not all original media bytes. Viewing/download fetches originals as needed.
**Index existing uploads** reconciles this installation's completed, previously
verified upload history against current remote HEAD metadata. It is not a new
full-byte verification or a discovery tool for unrelated pre-existing objects.
Public trip uploads do not depend on the private index or private credentials.

Higher revision clocks win. Equal-clock conflicts keep the more restrictive
state and flag it for review. Tombstones prevent old active revisions from
resurrecting deleted originals and automatic backup respects those exclusions.
The index is designed for this personal app; concurrent independent writers
should not deliberately edit the same recovery records outside Atlas.

## Cloud and phone trash

Cloud trash applies only to managed private cloud records. Moving into trash
retains the encrypted original. Restore checks the object's saved ciphertext
size/hash metadata. Recovery periods (7/30/60/90 days) are persistent **reminders**;
there is deliberately no unattended permanent deletion.

Permanent deletion requires a second confirmation and native authentication.
The encrypted tombstone is durably published before any original is deleted.
Cleanup checks stored checksums before deleting only its exact managed original
and previews. Interrupted deletions remain under **Show deletion records** with
**Retry cleanup**. Deleted items cannot be restored. Phone originals, trip
memberships, public media and website catalogs are not deleted by cloud trash.

**Phone trash** uses Android 11+ MediaStore trash requests and Android's own
confirmation screen. Atlas can list/restore only files Android permits it to
access. Other apps' trash may not be visible. Android controls phone-trash expiry;
cloud preferences do not change that policy. There is no direct permanent phone
file deletion button in this release.

## Fast previews

New private uploads generate separate bounded JPEG thumbnails (images <=640px;
video-frame thumbnails 480×320 where the platform can decode them). These are
Tink encrypted in R2. The library requests thumbnails only near the viewport,
with four simultaneous requests, a bounded local cache, and page sizes of 50.
Private preview sessions require authentication and end on background/close;
decrypted previews are cleared. Original download remains native/SAF.

Optional short clips use official AndroidX Media3, first 15 seconds, 720p H.264
and AAC, on an unmetered connection while charging. They are separate encrypted
objects, clearly labelled previews, never replacements for the original. Codec
support varies; failures leave the original intact. No hardware codec or physical
phone validation is implied by Java compilation or Robolectric tests.

## Google Takeout import

Choose up to 10 ZIP parts through Android's document picker. Review/start each
archive explicitly. Import is native and offline, Android 10+, into
`Pictures/Atlas Imports` and `Movies/Atlas Imports`; no full file crosses JS.
Media bytes are streamed unchanged, CRC checked by the ZIP reader, SHA-256 hashed,
and exposed only after the pending MediaStore row is complete. Unsafe paths are
rejected and archive paths never become filesystem paths. Originals are not
silently overwritten. Import needs room for extracted files plus a reserve.

Supported JSON sidecars preserve title, description, photo/creation time, valid
coordinates and album-folder references in the local encrypted index, without
rewriting media bytes. Dates are also applied to the app-created MediaStore row.
The Places scanner can use imported location/time, identified as Takeout data.
When imported media is subsequently backed up, its supported metadata is included
in the encrypted cloud index. Local sidecar data alone is not recoverable after
clearing app storage; keep the Takeout ZIPs until backup and restore are verified.

Sidecars before or after media are handled. A remaining unmatched-sidecar count
is shown; import remaining ZIP parts before reviewing it. Truncated/ambiguous
filenames are not guessed. This is not a lossless importer for every Google JSON
field, edited-version relationship, face annotation, special album type or live
photo pairing. ZIP is supported; TGZ/folder-tree imports are not implemented.
Descriptions/locations are metadata, not a promise of complete Google Photos parity.

Pause/resume checkpoints completed ZIP entries and cleans up only the import's
own pending rows. Resume reads ZIP data again to reach remaining entries. Keep
selected source ZIPs unchanged until completion. Identical content across albums
is reused only after re-reading the existing imported bytes and verifying SHA-256;
album references are merged. Imported originals appear in Gallery after refresh.
Nothing is published, and no cloud upload occurs unless its album has separately
been selected for automatic backup or you approve a manual upload.

## Verification boundaries

Automated tests use synthetic media, fake R2 transports, native encryption and a
synthetic MediaStore provider. They never access a personal bucket. Browser tests
exercise the real React components with native API fixtures; they cannot prove
Android permission dialogs, OEM background execution or hardware codec behavior.
Keep Google Photos originals/Takeout exports until a physical-device backup and
independent recovery test of your own files succeeds.
