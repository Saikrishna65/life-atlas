# On-device gallery search — first milestone

The phone gallery remains usable without search analysis, internet, R2 configuration or a model download. This change does not build an APK, alter public pages, publish media, modify originals, or enable automatic cloud backup.

## User flow

Gallery → Backup → Smart photo search (also available under Search → Search settings).

- **Words in photos**: bundled ML Kit Latin recognizer for English text; works offline. Enable this for tickets, signs, receipts and screenshots.
- **Search by description**: opt-in download of two quantized CLIP encoders, 153,621,508 bytes (about 154 MB decimal). English descriptions work best. The download host sees the model request, never photo bytes or search queries.
- Choose all accessible albums or specific named albums. Charging-only analysis and unmetered-only model downloads default on. MediaStore permissions remain the authority, including Android's limited-photo access.
- The Photos search offers **Filenames** (all accessible files, including videos) and **Smart search** (analyzed local photos, ranked by OCR/metadata matches and visual similarity). Smart results are approximate. Video frames and cloud-only originals are outside this milestone.
- Pause retains results. Resume keeps the page checkpoint; unchanged successful photos are skipped. Scan checks new/changed photos; a periodic scan runs approximately every 12 hours when Android permits it. Change preferences rebuilds derived data with the new scope. Remove search data clears the derived index and model, without touching photos, trips, transfers or cloud files.

## Native implementation

`GalleryIntelligence` and `GalleryIntelligenceWorker` use the existing bundled-origin/Android-26+ `AtlasR2Storage` guard. An epoch prevents a stopped worker from saving after pause, scope changes or removal. WorkManager serializes 80-photo pages with battery/storage constraints, periodic incremental scans, exponential retry, and persisted page checkpoints. Interrupted pages repeat safely, skipping successfully indexed source versions. Android may defer/stop work; this is not an uninterrupted foreground-upload service.

Bounded native bitmap decoding applies orientation, with a maximum 1,600-pixel long edge. CLIP uses RGB bicubic center-crop sampling to 224 × 224, documented CLIP channel normalization, a 512-dimensional normalized embedding, and cosine ranking. The text encoder uses the upstream CLIP byte-level BPE vocabulary, 77-token truncation and EOS handling. Query normalization supports Unicode NFC, whitespace and lowercasing; it does not include Python ftfy's complete malformed-text repair. No image buffer or embedding crosses the WebView bridge. English queries are recommended.

Models:

- `Xenova/clip-vit-base-patch32`, immutable revision `6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d`, upstream OpenAI CLIP MIT license.
- `onnx/vision_model_quantized.onnx`: 89,117,001 bytes, SHA-256 `583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299`.
- `onnx/text_model_quantized.onnx`: 64,504,507 bytes, SHA-256 `73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a`.
- Checksums and lengths verified against the upstream Git LFS pointer files. Downloads are HTTPS, size bounded, resumable with HTTP Range, SHA-256 checked, and renamed only after validation. No untrusted model URL is accepted from JavaScript.
- Bundled `clip-merges.txt` is the first 48,894 merges from OpenAI's `clip/bpe_simple_vocab_16e6.txt.gz`; SHA-256 `685491abbdad36159d094ecdc23bebc0dd53f8d1df35c4d74ef6036db2ba7572`. Upstream MIT notice is bundled alongside it.
- ONNX Runtime Android 1.23.2 (CPU, two intra-op threads); ML Kit text-recognition 16.0.1. Actual ARM64 ELF load-segment alignment checked at 16 KB for both ONNX libraries and the OCR pipeline. ML Kit is governed by its own terms, not CLIP's MIT license.

The app keeps its existing minSdk. ONNX's declared minSdk24 is overridden **only because this feature is gated to API26+**. ML Kit's automatic startup provider is disabled below API26 through versioned resource values; the worker also refuses older APIs. Other SDK overrides are not used. No physical-device compatibility claim follows from compilation/alignment checks.

`GallerySearchStore` stores per-photo OCR, metadata and vectors as AES-GCM sealed SQLite payloads through the existing Android Keystore layer, in `noBackup/r2/gallery-search.db`. IDs are hashed for lookup; filenames, text, URI details and vectors are not SQLite plaintext. Settings/checkpoints are in native secure state. The index is rebuildable and deliberately excluded from ordinary JavaScript backups/public catalogs. Keystore invalidation prevents reading the encrypted index; no plaintext fallback is used.

Source stamps include size, modified time and MediaStore generation where supported. Results re-check the currently accessible, untrashed original before returning metadata, excluding changed or removed photos. Results are paginated with a bounded native top-match heap; no full-resolution image download is needed for thumbnails. Ranking scans the encrypted index on native threads; very large libraries may need an approximate-nearest-neighbor index in a later milestone.

## Validation and remaining device checks

Tests cover reference tokenization, source-version invalidation, encrypted-at-rest round trip/tampering, safe clearing, OCR term matching, RGB normalization, vector normalization, invalid models, and UI settings/search flows. The browser harness uses native fixtures; it cannot certify actual Android ML inference, phone thermals, OCR quality, photo-provider behavior or battery scheduling. Full CLIP model downloads are blocked by this workspace's network policy; real model inference and an Android device run must be verified before treating visual search as production validated.

Next milestones remain separate: similar/duplicate-photo review, blur/quality suggestions, video scene indexing, people grouping with explicit consent, richer local natural-language filters, and memory suggestions. No face recognition, automatic deletion, fabricated captions, assistant API integration or automatic publication is implemented here.

## Validation and current limits

- TypeScript and targeted ESLint checks, 62 gallery/studio/storage tests, production Next.js build and offline WebView bundle passed locally.
- Real Chromium regression flows passed for Gallery, Places and Library, including a 2,000-item library, selection/publication safeguards, pinch gestures, video controls, mobile smart-search settings, model consent, pause/resume and index removal. Native/cloud responses in these browser tests are fixtures.
- The pinned ONNX files passed real CPU inference in the test-only CI workflow using a synthetic image and two text queries: expected encoder input/output names, finite 512-dimensional vectors, checksum/length checks and normalized cosine. This is not a physical Android benchmark.
- Native Android source/unit-test compilation passed. Robolectric tests use the supported legacy SQLite test backend, because this repository excludes Robolectric's separate native ICU runtime. CI runs both debug and preview unit-test variants without assembling an APK.
- Still needs physical-device validation: bundled OCR recognition quality, real phone media permission changes, Android background scheduling, model download/resume over changing networks, latency, heat and memory on the Moto. Do not equate compilation, desktop model inference or Robolectric with device testing.
- Search currently scans encrypted vectors natively with bounded result memory, paginates at 80 and caps a query at 10,000 returned results. A native approximate-nearest-neighbor index is a later improvement for very large libraries. Index counts describe saved analyzed rows; search revalidates the source version and permission before displaying a result. Removing/rebuilding the index clears obsolete derived rows.
- Analysis is opt-in, local photos only; videos remain searchable by filename. There is no face recognition, person identification, arbitrary chat, automated deletion, automatic publishing or cloud-photo analysis in this milestone.
- No APK is built or released. The feature reaches the phone when an Android build is explicitly requested later.

OCR records carry the `latin-v1` revision. Previous bilingual OCR is excluded from text search until the next scan replaces it with Latin-recognizer output; existing photo embeddings remain reusable. The dedicated Devanagari model is not bundled. Unicode tokenization in CLIP remains independent of OCR language selection.
