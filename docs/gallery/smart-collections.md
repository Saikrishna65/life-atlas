# Private gallery smart collections

Gallery → Organize now offers **Similar photos**, **People**, and **Albums & memories**. They work with accessible local photos under Android's existing permissions. No photos, face vectors, names, or review choices are sent to an AI service or added to public catalogs. The signed 2.0.3 update carries the current gallery implementation.

## Similar photos

Enable analysis from Similar photos or search settings. Native code reuses one orientation-corrected, software sRGB decode (long edge at most 1,600 pixels) for enabled analysis. A 128-bit perceptual hash, tiny luminance/color signature and capture-time proximity identify conservative near-duplicate groups. A bounded BK-tree search avoids a full all-pairs photo comparison. Groups compare against their anchor rather than chaining a whole walk together. Flat images are excluded from similarity suggestions.

Clarity, exposure and resolution provide an approximate **Suggested best**. This is not an aesthetic judgement or a deletion recommendation. Open an original, choose **Keep as my pick**, separate a photo, dismiss a group, or reset reviews. A confirmed pick is saved against the source version and survives new members joining the group. All originals remain. Edited/replaced sources are revalidated before review.

## People — optional and confirmed by you

People grouping requires a separate consent checkbox, enforced in native code. It downloads 10,129,522 bytes of pinned, checksum-verified OpenCV Zoo models: YuNet detection (MIT) and quantized SFace recognition (Apache 2.0). Existing ONNX Runtime CPU infrastructure is reused with two intra-op threads; there is no additional runtime dependency or general-purpose LLM.

The model files, source revision, tensor shapes, alignment points and upstream license notices are recorded in `GalleryFaceModels`, `scripts/verify-gallery-faces.py`, and bundled model notices. The verifier downloads the immutable files, checks their SHA-256 hashes, and performs real detector/aligned-encoder CPU inference using the upstream licensed demo image. It runs in the test-only GitHub workflow, not on a user's photos.

Faces produce unnamed suggestions. Only a name you enter, a match you explicitly confirm, or a merge into a person you selected creates named membership. A later probable match is shown separately as **Possibly [name]** until confirmed; it does not silently join a named person. Face similarity is fallible. Open the source, move a face to another confirmed person, separate it, or select **Not a face**. Two faces from the same photo are not automatically grouped together. Named groups use up to eight diverse confirmed references rather than only the earliest photos. Review supports one-group and multi-group merges into a named person, one-step undo, chosen cover faces, hiding and restoring hidden people. Group merges never delete or edit originals. Large candidate sets use fixed projection buckets with bounded comparisons, which can miss matches rather than promise perfect identification.

Native encrypted SQLite rows hold source details, embeddings and small aligned 112-pixel face crops. WebView responses contain collection summaries, source metadata and requested face thumbnails, never embeddings. Crops are loaded lazily; no global face-thumbnail cache is persisted in JavaScript. Disabling People or choosing **Forget people** stops that work, removes the models and erases face rows, names and corrections while retaining originals and other enabled analysis. **Remove analysis data** clears all derived analysis/reviews/models; it does not delete media, trips or cloud objects.

## Albums and anniversary memories

This month, This year, Videos and Screenshots are computed on demand from MediaStore metadata. No model download, repeated image decoding or notification job is required. Anniversary cards use positive camera capture timestamps matching today's month/day in the device timezone in prior years. Missing capture dates are not replaced by import dates for memories. You can hide a memory and restore hidden memories. Opening an album uses the existing photo viewer, selection, trip and explicit backup flows; it does not automatically upload anything.

## Battery, storage and large libraries

- Charging-only analysis and unmetered-only optional model downloads default on. WorkManager requires battery and storage not low. Battery Saver or severe thermal status defers analysis with backoff. Android controls actual execution; there is no continuous camera polling or foreground inference service.
- Unchanged successful source versions are skipped; only selected accessible albums are analyzed. An epoch invalidates stopped workers before saving results. Pause/resume and remove-data controls remain available.
- Quality analysis needs no model. People uses about 10.1 MB of optional files. The existing description-search CLIP download is separate, about 154 MB, and remains opt-in. These features do not require it.
- Full crops/OCR, collection summaries and search entries are separated into encrypted tables. Browsing summaries does not decrypt crops/OCR; ordinary text/vector search does not deserialize face crops. Progress uses a small encrypted record rather than rewriting the shared secure R2 JSON file per photo. No original is duplicated for analysis.
- Collection metadata revalidates source versions in one MediaStore pass. Cards paginate at 40; media and face reviews paginate at 80; covers use the existing bounded thumbnail queue. Native collection snapshots cap at 100,000 photos/50,000 faces with a visible partial-results message.
- Collection results and memberships are materialised as encrypted SQLite pages (40 cards, 80 members/faces). Names are stored once per snapshot, never duplicated per photo. Snapshot pages survive app restarts, are invalidated by actual media/choice changes, and are warmed after analysis. Existing unmodified collection views do not regroup on every opening. Scene search still scans encrypted vectors. This is not an approximate-nearest-neighbor search engine. Memory, first-scan duration, per-photo index bytes, heat and battery drain have not been measured on a phone. A large initial scan can take time, especially with optional models enabled.
- Analysis and names are stored locally in encrypted no-backup storage. Ordinary media backup is separate from the optional organisation-recovery sidecars described below. Losing the device/Keystore without that opt-in recovery can still lose local analysis and corrections.

## Validation

The verification workflow bundles the WebView, validates the pinned CLIP/face models with real desktop CPU inference, and executes debug/preview native Robolectric tests without APK packaging. Tests cover similar-photo anti-chaining and quality guards, stable source picks, conservative face matching, explicit consent, corrections, authenticated storage, erasure, source accessibility, native bridge summaries, timezones/capture dates and independent encrypted progress storage. Chromium regression tests exercise the real React UI with native fixtures, including consent, picks, names, forgetting, memory visibility and album browsing.

Physical-device validation remains required: face accuracy across real lighting/ages/skin tones, limited-media permissions, OEM photo providers, model download interruptions, scheduling, thermal/battery behavior and latency on the Moto. Desktop CPU inference and Robolectric do not certify those behaviors.

## Current viewer and navigation

The viewer uses three sliding surfaces for mixed photos/videos, with nearby thumbnail references reused from a bounded in-memory path cache. Only the selected video plays. Gesture navigation excludes buttons and the video seek bar, preserves pinch/pan, and respects reduced motion. Video controls overlay the bottom safe area. Photo information stays over the image. Hardware Back, browser Back and local navigation share ordered surfaces: information, viewer, review/selection, collection, Collections/Backup, Photos, then the gallery route. Other app routes retain their existing behavior.

## New media

Foreground MediaStore observers debounce changes. A WorkManager content-URI watcher covers supported background scheduling. MediaStore generation/version tokens (or a lightweight metadata signature on older/limited-access Android) prevent unchanged resumes from invalidating results. Analysis uses an overlapping modified/imported-time checkpoint and existing source versions; new or modified photos are decoded, unchanged photos are skipped. Charging-only is the default; disabling it selects balanced battery/storage/thermal-constrained work. Android can delay or stop background work. This is not a promise of immediate processing after force-stop, and limited photo permissions cannot expose unselected new photos.

## Encrypted organisation recovery

Gallery → Backup → **Save names & organisation**. The existing private bucket and verified recovery kit are prerequisites. Enabling automatic saves is separately device-authenticated. Only the private bucket is used; the approved endpoint/bucket scope is bound to the consent. Changing that scope requires enabling recovery for the new configuration again. Public catalogs and original media are never written by these jobs.

`GalleryRecovery` stores immutable, versioned, authenticated Tink-envelope sidecars under `encrypted/catalog/gallery-ai/<recovery-key-id>/`. Individual analysed-photo records carry their file checksum and derived analysis; a snapshot references those records and encrypted names, corrections, favourites, picks and memory preferences. Cached source-version hashes and verified uploaded-record references avoid repeatedly hashing or uploading unchanged records. Snapshots are published only after referenced writes verify by authenticated readback. Progress uses small encrypted native records, not shared R2 JSON rewrites.

Restore requires the same independently saved recovery kit and private credentials. Face restoration requires an explicit checkbox. The worker downloads and authenticates metadata before staging it. It hashes only plausible local originals of matching sizes and reconnects exact bytes, remapping Android IDs and face references; filenames and approximate coordinates are not identity matches. Unmatched records remain encrypted locally and reconnect as matching originals become accessible. Pending cloud-only members use their own recovery identities when saved again, so reused phone IDs cannot attach their favourites or group references to a different picture. Existing local corrections take precedence. Restoring organisation does not download missing original media.

Transfers are serialized, network-aware, charging/battery constrained and retry transient I/O failures. Pause and automatic-saving controls are available. Snapshot payloads are bounded at 16 MiB, up to 100,000 record references; larger exports fail explicitly and retain existing snapshots. The build and tests do not access a personal bucket. A real-bucket migration and interruption test remains required on the phone.

**Retention:** no old cloud snapshots are automatically deleted. Forget people scrubs local face records, collection caches, undo and staged face restoration, and prevents pending recovery from reinstating them. Previously saved encrypted cloud snapshots remain until explicitly managed in private storage. Remove analysis data also clears local staged recovery. Original photos, cloud originals, trips, credentials and transfers are retained.

## Remaining separate work

Natural-language combinations of place/date/trip filters and an approximate-nearest-neighbour index for very large semantic-search libraries remain future work. These do not require a larger chat model. Initial photo decoding, first analysis, cloud-only downloads and a large initial recovery still involve real I/O; persisted caches cannot make every first load instantaneous. Face grouping remains fallible and user-confirmed.
