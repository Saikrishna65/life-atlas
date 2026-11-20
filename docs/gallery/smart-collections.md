# Private gallery smart collections

Gallery → Organize now offers **Similar photos**, **People**, and **Albums & memories**. They work with accessible local photos under Android's existing permissions. No photos, face vectors, names, or review choices are sent to an AI service or added to public catalogs. No APK is built by this change.

## Similar photos

Enable analysis from Similar photos or search settings. Native code reuses one orientation-corrected, software sRGB decode (long edge at most 1,600 pixels) for enabled analysis. A 128-bit perceptual hash, tiny luminance/color signature and capture-time proximity identify conservative near-duplicate groups. A bounded BK-tree search avoids a full all-pairs photo comparison. Groups compare against their anchor rather than chaining a whole walk together. Flat images are excluded from similarity suggestions.

Clarity, exposure and resolution provide an approximate **Suggested best**. This is not an aesthetic judgement or a deletion recommendation. Open an original, choose **Keep as my pick**, separate a photo, dismiss a group, or reset reviews. A confirmed pick is saved against the source version and survives new members joining the group. All originals remain. Edited/replaced sources are revalidated before review.

## People — optional and confirmed by you

People grouping requires a separate consent checkbox, enforced in native code. It downloads 10,129,522 bytes of pinned, checksum-verified OpenCV Zoo models: YuNet detection (MIT) and quantized SFace recognition (Apache 2.0). Existing ONNX Runtime CPU infrastructure is reused with two intra-op threads; there is no additional runtime dependency or general-purpose LLM.

The model files, source revision, tensor shapes, alignment points and upstream license notices are recorded in `GalleryFaceModels`, `scripts/verify-gallery-faces.py`, and bundled model notices. The verifier downloads the immutable files, checks their SHA-256 hashes, and performs real detector/aligned-encoder CPU inference using the upstream licensed demo image. It runs in the test-only GitHub workflow, not on a user's photos.

Faces produce unnamed suggestions. Only a name you enter or a match you explicitly confirm creates named membership. A later probable match is shown separately as **Possibly [name]** until confirmed; it does not silently join a named person. Face similarity is fallible. Open the source, move a face to another confirmed person, separate it, or select **Not a face**. Two faces from the same photo are not automatically grouped together. Large candidate sets use fixed projection buckets with bounded comparisons, which can miss matches rather than promise perfect identification.

Native encrypted SQLite rows hold source details, embeddings and small aligned 112-pixel face crops. WebView responses contain collection summaries, source metadata and requested face thumbnails, never embeddings. Crops are loaded lazily; no global face-thumbnail cache is persisted in JavaScript. Disabling People or choosing **Forget people** stops that work, removes the models and erases face rows, names and corrections while retaining originals and other enabled analysis. **Remove analysis data** clears all derived analysis/reviews/models; it does not delete media, trips or cloud objects.

## Albums and anniversary memories

This month, This year, Videos and Screenshots are computed on demand from MediaStore metadata. No model download, repeated image decoding or notification job is required. Anniversary cards use positive camera capture timestamps matching today's month/day in the device timezone in prior years. Missing capture dates are not replaced by import dates for memories. You can hide a memory and restore hidden memories. Opening an album uses the existing photo viewer, selection, trip and explicit backup flows; it does not automatically upload anything.

## Battery, storage and large libraries

- Charging-only analysis and unmetered-only optional model downloads default on. WorkManager requires battery and storage not low. Battery Saver or severe thermal status defers analysis with backoff. Android controls actual execution; there is no continuous camera polling or foreground inference service.
- Unchanged successful source versions are skipped; only selected accessible albums are analyzed. An epoch invalidates stopped workers before saving results. Pause/resume and remove-data controls remain available.
- Quality analysis needs no model. People uses about 10.1 MB of optional files. The existing description-search CLIP download is separate, about 154 MB, and remains opt-in. These features do not require it.
- Full crops/OCR, collection summaries and search entries are separated into encrypted tables. Browsing summaries does not decrypt crops/OCR; ordinary text/vector search does not deserialize face crops. Progress uses a small encrypted record rather than rewriting the shared secure R2 JSON file per photo. No original is duplicated for analysis.
- Collection metadata revalidates source versions in one MediaStore pass. Cards paginate at 40; media and face reviews paginate at 80; covers use the existing bounded thumbnail queue. Native collection snapshots cap at 100,000 photos/50,000 faces with a visible partial-results message.
- Collection grouping still reads the compact encrypted summaries on demand; scene search still scans encrypted vectors. This is not an approximate-nearest-neighbor search engine. Memory, first-scan duration, per-photo index bytes, heat and battery drain have not been measured on a phone. A large initial scan can take time, especially with optional models enabled.
- All analysis and naming is currently local-only and Keystore-protected in no-backup storage. Losing the device/Keystore can lose names and corrections. Ordinary media backup is not AI-index recovery. No recoverable index export or backup is claimed.

## Validation

The verification workflow bundles the WebView, validates the pinned CLIP/face models with real desktop CPU inference, and executes debug/preview native Robolectric tests without APK packaging. Tests cover similar-photo anti-chaining and quality guards, stable source picks, conservative face matching, explicit consent, corrections, authenticated storage, erasure, source accessibility, native bridge summaries, timezones/capture dates and independent encrypted progress storage. Chromium regression tests exercise the real React UI with native fixtures, including consent, picks, names, forgetting, memory visibility and album browsing.

Physical-device validation remains required: face accuracy across real lighting/ages/skin tones, limited-media permissions, OEM photo providers, model download interruptions, scheduling, thermal/battery behavior and latency on the Moto. Desktop CPU inference and Robolectric do not certify those behaviors.

## Features explained, not implemented in this milestone

**Natural-language combined filters** would understand “photos in Tungnath from November 2026 in my Uttarakhand trip” as a place, date range and trip filter, with optional existing visual ranking. Today's filename/OCR/visual search does not promise those structured combinations. A small local parser and explicit filter chips can deliver this without a chat LLM or a network call.

**Encrypted AI-index recovery** would back up analysis, confirmed names and corrections separately from photos using an independently recoverable key, and restore only records matching current source versions. The Android Keystore alone cannot recover another device's data. A validated restore flow is required before enabling this.

**Faster large-library search** would add a versioned native vector index, incremental updates and bounded nearest-neighbor queries. It is a performance/data-index feature, not a larger AI model. It should be driven by measured phone library sizes and latency, not enabled merely to add complexity.
