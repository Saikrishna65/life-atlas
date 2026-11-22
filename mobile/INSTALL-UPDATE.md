Atlas 2.2.6 — Final square-grid and photo-motion update

Install atlas.apk over Atlas, or use Control Room → Access → App updates.
Version code 42; package and signing identity are unchanged. Do not uninstall.

Includes the compact mosaic and coordinated photo transitions described below.
Photos whose thumbnails are still unavailable now also get a single gentle fade,
so they cannot fall back to an instant entrance. Originals and existing data remain.

Historical release notes below.

Atlas 2.2.5 — Square-cell gallery and coordinated photo transitions

Install atlas.apk over Atlas, or use Control Room → Access → App updates.
Version code 41; package and signing identity are unchanged. Do not uninstall.

• The grid now uses square cells, occasional four-cell squares and two-cell wide
  tiles. Portrait metadata cannot create long, narrow columns. Mobile defaults to
  four columns; View options still controls density. Originals stay unchanged.
• Photo opening/closing uses decoded images, matched transform timelines and a
  coordinated backdrop. The extra entrance fade and animated clipping mask are gone.
• If the original is still decoding, the saved image stays visible until a smooth
  handoff. Closing during opening reverses that same transition instead of jumping
  to a full-size closing image.
• Videos and reduced-motion settings use a simple fallback. If a photo's grid tile
  is off-screen or unavailable, dismissal also uses the fallback.

Existing search optimizations, cloud data, uploads and AI indexes are unchanged.
Phone-specific smoothness still needs checking on your device.

Historical release notes below.

Atlas 2.2.4 — Gallery motion and search

Install atlas.apk over Atlas, or use Control Room → Access → App updates.
The package and signing identity are unchanged; version code 40. Do not uninstall.

• Rapid swipes and arrow keys advance immediately; the next swipe can interrupt
  the current slide rather than being discarded.
• Photos expand from their thumbnail and shrink back to it when the tile is
  visible. Reduced motion and absent thumbnails use the simple fallback.
• Natural-ratio masonry keeps portraits tall; wide landscapes can occupy more
  space. Rotated camera dimensions are corrected without changing originals.
• Smart Search starts local text matches earlier, then refines with visual
  matches after typing settles. Approved, already-installed visual models can
  prepare when search opens, without downloading another model.
• A bounded decoded index avoids repeated decryption/vector parsing. Its memory
  cache expires after 30 seconds idle and is cleared in the background. The visual
  worker is retained briefly, for at most 20 seconds idle, and released on pause.

Cold visual queries and large libraries can still take time. Device-level speed
and gesture smoothness need testing on your phone. No personal cloud data is reset.

Historical release notes below.

Atlas 2.2.3 — Gallery fixes

Update through Atlas → Control Room → Access → App updates, or install atlas.apk
over Atlas. Package and signing identity are unchanged; version code 39.
Do not uninstall or clear app data.

• Photo grid pinching is removed; fixed mobile/desktop layouts are restored.
• Viewer uses a short fade instead of stretching a thumbnail when opening/closing.
• Photos and collection pages remember their own scroll positions and loaded lists.
• Long-press text to select it; holding a point without text tries to lift that subject.
• Subject inference runs in a separate, non-exported Android process. A failed
  worker returns an error instead of executing its model in Atlas's main process.
• Text & stickers uses a compact, centred panel, including small phone screens.
• Gallery settings → Add Gallery to home screen requests a launcher shortcut.
  Alternatively, long-press Atlas Gallery in the app drawer and drag it home.

First subject extraction may download a Google Play services model. It requires
compatible Play services; cutout quality depends on the photo. No personal cloud
objects, originals, keys or existing data are reset.

Historical release notes below.

Atlas 2.2.2 — Gallery interaction and extraction update

Install through Atlas → Control Room → Access → App updates, or install atlas.apk
over the existing Atlas/Atlas Next. Package identity stays com.lifeatlas.app.next;
version code 38. Do not uninstall or clear app data.

Long-press a local photo for text/stickers; More offers extraction and Teach Atlas.
Subject extraction is optional and may require a Google Play services model
download. PNG cutouts are separate derivatives; sharing to WhatsApp does not install
a sticker pack. Swipe-up defaults to WhatsApp and can be changed in More.
Favourites opens inside Collections. Pinch the photo grid to change its density.
Search starts automatically after a short typing pause; visual results need an
indexed photo library and the approved visual model.

No cloud reset/migration or automatic public publishing occurs. Public metadata
relations are extended compatibly on subsequent explicit publishing operations.
Private originals, AI corrections and recovery stay encrypted and separate.
See docs/gallery/gallery-2.2.md for implementation and validation limits.

Historical release notes below.

Atlas 2.1.0 — one integrated app

Download atlas.apk. It updates the existing Atlas Next package
(com.lifeatlas.app.next) under the visible name Atlas, preserving its data and
signing identity. Version code: 35. Do not uninstall or clear app storage.
Atlas Gallery is a second icon for the same installed app, opening Photos directly.

The legacy atlas-offline-online.apk is only for an existing com.lifeatlas.app
installation. It does not share the other package’s private storage. You do not
need to install both APKs.

Open Control Room → Access → App updates to check, download or install later
releases. Daily public release checks are optional. Downloads require approval
and use Wi-Fi by default. Android requires permission to install from Atlas and
its own installation confirmation; silent installation is not supported. A killed
app can interrupt a download; retry from Updates. Nothing is reset or uploaded.

AI: open Atlas AI from the launcher orb or home. Voice and wake-word settings
are opt-in. Cloud AI requires your provider key and consent. Local language-model
inference and unreviewed model downloads remain unavailable. Sensitive hosted
APIs remain blocked until server authentication exists; direct native R2 is
separate. Keep your independent recovery keys outside this app.

Historical release instructions follow; use the instructions above for 2.1.0.

Atlas 2.0.5 — isolated Smart Search and advanced gallery tools

1. Keep your existing app installed. Do not clear its storage.
2. If the installed app is Atlas Vault, download atlas-offline-online.apk.
   If it is Atlas Next, download atlas-next.apk.
3. Open the matching APK and choose Update. This build uses version code 34.
4. Read signing-compatibility.json. An update build must match the published
   1.4.4 stable certificate. A fresh-install build instead verifies the APK against the
   preserved signing key and may NOT update older releases. Use that mode only
   when no app with the same package is installed. Do not remove an app with
   unsaved data just to use a fresh-install APK. Future builds reuse this key.
5. If Android still reports a package conflict, stop. Earlier releases and local
   debug builds can have a different certificate. Do not uninstall to bypass it.
   An in-place update requires the original signing key. Report the installed app
   name, version and where its APK came from.
6. Atlas Next uses com.lifeatlas.app.next; Atlas Vault uses com.lifeatlas.app.
   They have separate databases. Installing Next beside Vault does not import
   Vault data. Neither app needs to be removed to keep the other.

This build does not upload, restore or reset personal/cloud data. It checks types,
signing authorization, APK compatibility, native unit tests, APK signatures,
package IDs and version codes. Actual installation and permissions require a phone.
The ZIP contains SHA256SUMS.txt and signing-compatibility.json for verification.

Maintainers: run “Build offline and online Atlas APK” on main with install_update
checked. The owner must trigger it: existing signing authorization accepts only
the repository owner's GitHub identity. This mode only loads the existing key;
it cannot initialize or rotate it. No signing key is included in release files.

R2 connection fix: requests now use the AWS S3 signer with payload hashes, without
AWS chunked encoding. Native transport errors have safe, actionable diagnostics.
Update the existing Atlas Next app; saved R2 credentials remain in native storage.
No user bucket was accessed by the build or test suite. Retest your connection
inside the app after installing the update.

Creator Studio: create a trip and choose its globe pin, add named places, then
select photos/videos under each place. Up to 20 media files per selection; repeat
for more batches, up to 250 cloud media items per trip. Nothing is uploaded until
you approve publishing. Pending transfers and completed public media are saved
per place. Website updates append media and preserve existing routes/statistics.
The public loader now waits only for the initial viewport, with a four-second
asset budget after hydration. Other scenes and media remain lazy-loaded.

Trip publication recovery: trip photos now create independent immutable publication
records rather than modifying the shared current.json catalog. Existing catalog
entries are retained. The website receives approved trip media through its existing
publishing API. The native library combines existing catalog entries with this
device's securely saved publication index. Standalone legacy catalog publishing
still uses conditional updates and can report a catalog conflict.

Install over the existing Atlas Next app without uninstalling or clearing storage.
Open the existing Creator Studio trip and tap Publish again. Named-place selections
and transfer IDs survive this update; verified completed uploads are reused. The
build does not access your bucket or upload any personal photos.

Trip publishing: verify once to approve this selected public batch. There is no
upload approval timer, foreground requirement, screen-lock expiry or background
expiry. Every selected file is bound to a durable native transfer ID before any
upload depends on WebView polling. A single serial WorkManager graph persists the
whole batch, with network constraints, foreground transfer notifications and the
existing multipart recovery and original-byte verification.

Continue in background leaves all approved native uploads queued. You can use
other app screens or lock your phone. Android may delay work, enforce background
quotas or stop the process; uninterrupted execution cannot be guaranteed. WorkManager
retains committed jobs, and retry recovers the same saved IDs instead of uploading
completed originals again. Explicitly paused/cancelled files are not silently
made public by an unrelated operation. Resuming a reviewed batch retries paused
or failed jobs; cancelled jobs require review in Cloud Storage.

The website update can finish while the WebView remains active. If Android suspends
or destroys it, return to this trip to finish the website metadata update using
already verified native uploads. A restarted/replaced publishing session may need
one fresh verification; this does not stop committed native uploads. Configuration
changes, deletion, private storage and unrelated files still require authentication.
The in-memory public grant ends only when this workflow finishes/stops, is replaced,
the process ends or credentials change; it cannot authorize arbitrary bucket access.

Install over the existing Atlas Next without uninstalling or clearing storage.
Your existing named-place selections, transfers, original media and route data are
preserved. No personal cloud uploads or physical-device tests run in the build.

Stopped uploads: Cloud Storage → Transfers now shows Android WorkManager status,
queued dependencies, retry scheduling, quota/background stop reasons where Android
provides them, and separate verification bytes. Running files sort before later
queued files. Native transient failures remain queued while Android retries them;
the publisher no longer appends duplicate jobs during that backoff.

Use Resume approved uploads to restore missing/finished scheduler work for existing,
previously approved public trip uploads. It reuses the same object keys, file URIs
and multipart state. It skips running/scheduled work, completed files, manual pauses,
cancelled jobs, private/unapproved uploads, changed credentials and non-transient
permission/authentication failures. The publisher attempts this recovery once if
its current approved upload has no active Android job. No expiry was reintroduced.

The exact cause of the reported phone stoppage was not available during implementation.
This build adds actionable status and narrow recovery rather than claiming a specific
on-device cause. Physical-phone and live-bucket testing are still required.

Trip covers: Creator Studio → Past trips → select a journey → Cover frame.
Choose an uploaded photo or video, preview desktop/mobile framing, then tap
Update website cover. For new unpublished media, publish the trip first.
A cover change does not re-upload files or alter routes, place groups or galleries.
The redesigned Studio includes a searchable journey rail and direct editing steps.

Duplicate uploads: native uploads compare file content against verified upload
history in this installation. A matching object in the same bucket is checked
and reused rather than uploaded again. Public/private storage and metadata
privacy choices stay separate. Original files and previous cloud objects are
never deleted by duplicate detection. Existing historical duplicates are not
automatically removed. After resetting app storage or changing devices, upload
history must still be present to identify earlier random-key objects.

Private Gallery: open Photo & video gallery on the Private Atlas home screen.
Tap Choose photo access and grant full photo/video access to browse all accessible
MediaStore images and videos, or use Android selected-photo access. Change this
at any time under Permissions. No files upload merely because they are visible.

Select up to 100 files per Gallery batch (tap selection circles, long-press, or
use Select loaded). Add to trip / upload → trip → place. Save selections only
works offline. Save & upload originals requires explicit public-storage approval
and one native authentication for the batch. Use Trips & places → a trip →
website & cover controls to review publication and select a trip cover. Existing
Creator Studio remains available. Each trip supports 250 public media items.

Encrypted private upload is a separate action and requires verified recovery.
It never adds these files to the website queue. Private cloud previews require
network, authentication and temporary device space; cached decrypted previews
are cleared on close/background. Originals are not compressed or modified.

Not checked is distinct from not uploaded. Cloud checks use exact file hashes
and this installation's known upload history; they cannot find every object
uploaded elsewhere. Cached cloud listings are bucket-scoped and labelled.
Legacy trip publication status is refreshed when that trip is selected.


Library tools (1.8.0): Gallery → settings icon → Backup / Cloud photos /
Cloud trash / Takeout import. Private automatic backup is OFF by default.
Connect your private bucket and verify/save its recovery kit before enabling it.
Select albums, network and charging preferences, approve and save. Original
bytes remain unchanged; optional short video clips are separate previews.

Cloud trash keeps recoverable encrypted copies until you explicitly purge them.
Phone trash is separate and uses Android confirmation. Restore the same recovery
kit on a replacement phone, then Restore index from R2 to rebuild the cloud library.
Takeout ZIP import is offline and requires explicit Start for each archive; it
retains supported sidecar dates/locations/descriptions separately from originals.
See docs/GALLERY-LIBRARY.md for setup, supported formats and recovery limitations.

Gallery redesign (1.8.1): Photo-first collection, direct album browsing, explicit
Select / Done mode, thumb-reachable selection actions, journey chooser, and
unified Places and Backup tools. Search, filters, cloud-copy checks, encrypted
backup and publishing retain their existing behavior. Install as an update.

Gallery workspace (2.0.0) replaces the four-tab dashboard with Photos, Organize,
and Backup. Photos opens directly into the collection; search and view options
are opened only when needed. Organize contains device albums, journeys and Places.
Backup contains private-library, public-file, transfer, trash and import actions.

Select photos → Add or back up → Add to a trip → choose trip → choose place
→ review. Keep on my phone is the default; public upload is a separate approved
choice. Back up privately skips trip/place questions and never publishes files.
Private backup configuration and recovery are available under Backup.

2.0.1: Private Gallery has an edge-to-edge viewer with pinch zoom, panning,
double-tap and visible Delete. Phone deletion uses Android trash; cloud copies
and trip records are retained. Album covers load independently of the first page.


2.0.2: Gallery → Organize adds Similar photos, optional People grouping, and
Albums & memories. Similar-photo analysis needs no model download. People
requires explicit consent and a separate 10.1 MB model download. Names and
corrections remain local and encrypted; AI-index cloud recovery is not included.
English OCR and optional description search are also included. Charging-only
analysis defaults on. Battery Saver or high heat defers analysis.

Suggested first test: plug in the phone, select a small camera album in analysis
settings, enable Similar photos and leave People/description search off. Review
suggested picks, then test People separately with consent and Wi-Fi. Test
pause/resume and Forget people. Originals must remain unchanged. For detailed
coverage and limitations, see docs/gallery/smart-collections.md.


2.0.3: Photos and videos share a sliding viewer. Controls are at the bottom.
Android/browser Back closes information, the viewer or the current collection
before leaving Gallery. Organize is now called Collections. Native encrypted
collection pages are saved for reuse rather than regrouped on every visit.
People supports named-group merges (including selected groups), undo, covers,
hiding and multiple confirmed reference angles. New photos trigger incremental
analysis when Android permits, respecting charging/battery/thermal preferences.

Gallery → Backup → Save names & organisation: connect PRIVATE storage and
verify its recovery kit before opting in. Sidecars contain encrypted analysis,
names, corrections, favourites and picks, never public image metadata. Existing
cloud originals do not need deleting or uploading again. Restore uses the same
recovery kit, explicit face-data consent and exact original-file checksums.
Unmatched analysis stays encrypted locally and reconnects as originals arrive.
Restoring organisation does not download missing original media. Existing local
corrections are retained. Old encrypted snapshots are retained in the private
bucket; Forget people removes local data, not older cloud recovery snapshots.

Test on a small album first. Check swipe/pinch/video controls, each Back layer,
merge/undo, pause/resume, and offline browsing. Live R2 recovery and real phone
battery/heat remain device checks; build tests use synthetic data only.


Atlas Photos 2.0.4
------------------
A second Atlas Photos launcher icon opens Gallery inside the same installed app.
It shares existing photos, permissions, vaults, local database and protected shell.
It is not another package. Your Atlas Next icon and data stay in place.

Photos open directly from originals; neighbouring photos keep the same original
image elements while swiping, so returning does not restart a thumbnail-to-original
swap. Large grids use sharper, bounded 960-pixel cached derivatives (94% JPEG),
not every full-resolution original. Originals and original uploads are unchanged.
The native cache is capped at 96 MiB / 800 files; only three thumbnail requests
run concurrently. Original decoding speed and very large image memory use still
depend on the device and its WebView.

Viewer gestures: swipe sideways to navigate photos/videos, down to close, up for
actions, pinch/pan to inspect, double tap to zoom/reset, tap to toggle controls.
A short hold while zoomed temporarily magnifies detail. Info and Delete now live
in the bottom toolbar with Share, Favourite and More. Video controls sit above
that toolbar; recently opened videos remember their position for this viewer session.

Share one or up to 100 selected device files through Android's share sheet without
putting originals into JavaScript memory. Edit a copy opens an installed compatible
photo editor, then saves its result in Pictures/Atlas Edits; the camera original is
never writable by the editor. This build does not bundle a photo/video editor.
Use as offers Android's installed wallpaper/contact-photo handlers where available.
Original shares may include location metadata. Protected cloud shares create an
explicitly shared cache copy; unused shares are cleaned on subsequent sharing.

My albums are virtual: select files, choose Album, create one or add to an existing
album. Collections > My albums lets you rename, reorder or delete albums. Inside
an album, select a cover or remove members. Deleting an album does not delete files.
Long hold starts selection; drag across photos in selection mode to select more.
Pinch the grid to change density. Photos remain browsable offline.

Search recognises saved trip/place names, photos/videos, favourites, English month
and year, ISO dates, this/last month and this/last year. Tap the suggested Search
filters to apply; view options lets you change/reset them. Unknown names are not
geocoded or guessed. Scene/text search still needs the existing optional analysis.

People: existing names/face IDs are retained. Small quality checks score existing
face crops and prefer clear, diverse named references without another model. Review
possible matches shows uncertain duplicate groups. Confirm a name to merge, or
choose Different people; decisions are saved locally. No uncertain named match is
merged automatically. Aliases preserve merges when older metadata is restored.
Names, face corrections, favourites and custom albums participate in the existing
opt-in encrypted private metadata recovery. An independently verified recovery kit
is required. Backup is optional; do not reset the cloud to use this update.
Large recovery notes use immutable encrypted files to avoid SQLite CursorWindow
limits; all photo choices and indexes remain encrypted in no-backup app storage.

Free up phone space is manual and limited to 10 selected files per verification.
Each file must match an active, verified encrypted private original with the
current recovery key. Atlas reads and authenticates the entire cloud original,
checks its checksum and size, rechecks the local source, then asks Android to move
the phone copy to trash. A public copy alone never qualifies. Keep the recovery kit.
Large videos require a full download for verification and can take time/data.

Music import accepts common, lossless, legacy and specialist audio extensions.
Use Browse all files if the Android document provider hides a format. Multiple
selection is supported; exact byte duplicates are skipped, not different recordings
with matching titles. The original bytes are retained. Playback depends on the
phone's decoder; DRM-protected, DSD and tracker formats may import but not play.

Test on a phone: install the matching package as an update, open Atlas Photos,
try photos and videos, all swipe directions, pinch, system Back, share, favourite,
albums and editing a copy. Verify named people and rejected suggestions after
reopening. Test private metadata restore only with a recovery kit you have verified.
The automated suite uses synthetic media and cloud transports; it does not validate
physical-device gestures, camera codecs, installed editors or OEM launchers.


Atlas Photos 2.0.5
------------------
Smart Search runs only after Search/Enter is pressed. CLIP text inference is in a
non-exported :gallery_search Android service process, outside the activity/vault/
upload process. The client has a 30-second deadline, cancellation checks, low-memory
deferral and an encrypted eight-query vector cache. A failed service returns useful
filename/OCR results with an explanation, without restarting Atlas. Inference uses
one CPU thread, conservative graph optimisations and no retained CPU arena. Isolated
processes are released when unbound. This prevents a text-runtime crash from killing
the activity; the phone's original crash stack was not available for diagnosis.

Quick photo opening is independent of cloud-operation busy state. Gesture suppression
resets for every new touch, including after cancelled touches. Horizontal slides have
an 18px gutter. Dragging down hides controls, shrinks the content and fades the viewer
background. On release, supported media return to their visible gallery thumbnail;
if the target is offscreen, dismissal fades gracefully. Reduced motion skips travel.
Swipe UP opens WhatsApp's recipient picker (standard app, then Business fallback).
It does not choose a recipient or send a message automatically. More stays a button;
More and Info now use the same centred, light panel. Missing WhatsApp has a readable
error and ordinary Share remains available. Sharing is always an explicit user action.

Built-in editing: More > Edit photo. Crop, pan the crop, rotate, flip, straighten,
brightness and contrast use matching preview/native geometry with no empty corners.
Save creates a separate JPEG in Pictures/Atlas Edits, up to 3072px / 6MP at quality95.
It does not overwrite or resize the original. More > See unedited original opens
the linked source while available on this phone. Edit recipes and verified original
references participate in encrypted metadata recovery. Other installed editors remain
available separately. Saving built-in copies requires Android10+.

Videos: More > Browse video frames and Use current frame as video cover. Eight small
frames are created only on demand; covers use a sharper 960px frame. Current positions
are encrypted locally and saved at most once every five seconds plus pause/close.
Returning/reopening seeks to a saved position. Cover changes invalidate that video's
thumbnail. File changes invalidate positions/covers by source stamp. Video decoding
still depends on the Android/WebView codec and container support; there is no automatic
transcoding of originals. Slow or unsupported metadata can return an explicit error.

Supported Motion Photos: More inspects Google-style XMP embedded-MP4 offsets and
same-folder/same-volume matching JPEG/HEIC+MOV/MP4 names. Embedded MP4 boundaries are
checked before extraction; clips are cached read-only (64MB playback limit). Common
Samsung-only or other proprietary containers are not promised. A same-name companion
is a suggestion requiring explicit action. Play motion/companion, Share photo+video,
or Add both to a trip/backup keeps the two selected files together in the normal
review/approval flow. Sharing/backing up an embedded original keeps its entire original
file. There is no automatic upload of companions or private media.

Sharing privacy: More > Remove location tags from shared copies. Photos become a still
JPEG copy up to3072px/6MP without EXIF; motion/HDR extras remain only in the original.
Videos are remuxed into MP4 with original audio/video samples and no location set;
orientation is retained. Unsupported containers fail without sharing. Visible content
can still reveal a place. The source is never changed. Public website publishing keeps
its existing separate explicit approval. Hidden custom albums remove collection cards,
not photos from Photos; this is organisation, not another secure vault. Restore hidden
albums from My albums. Phone-original encryption and app protection are unchanged.

People: select multiple face detections and move them to an existing or newly named
person. Confirm up to eight reference faces, preferably clear and varied. Never group
these two people together saves a negative rule, respected by grouping/suggestions.
Undo remains available. References, aliases, negative rules and moves are stored locally
and included in opt-in encrypted metadata recovery, remapped only to verified files.
Search can combine confirmed people with saved places/trips and English dates; ambiguous
same-name people are not silently selected. Active filters have visible clear buttons.
No identity names are inferred and no new face/LLM model is bundled.

Gallery Settings: inspect actual temporary-image usage, choose a32/64/96/192MB photo
cache, clear rebuildable thumbnails/frames, and review largest phone files via native
pagination. Video frames are limited to16MB and motion clips64MB separately; in-progress
edits/shared exports/private cloud originals are not cleared. Analysis activity refreshes
only while this panel is visible, shows state, selected work, saved index records,
failures, constraints and pause/resume. First-time setup goes through feature consent.
Thumbnail backup badges distinguish known private backups, public copies, pending/
failed work and unchecked phone files. A cloud-list entry alone never proves cloud-only.

Recovery rehearsal: Settings > Verify recovery & organisation > enter the kit passphrase
> Choose kit & verify restoration. The independently saved file must match the current
key. A synthetic authenticated-encryption round trip is checked locally; active keys
are never replaced by verification-only mode. No personal file is uploaded/restored.

Phone validation still required: reproduce Smart Search repeatedly, including rapid
query changes, backgrounding and low-memory use; try WhatsApp/Business/not-installed;
check gesture travel with real photos/videos and device Back; test the phone's video
formats, crop outputs, Motion Photo variants and recovery-kit picker. Automated browser
native seams use synthetic fixtures, and native unit tests do not equal a phone test.
