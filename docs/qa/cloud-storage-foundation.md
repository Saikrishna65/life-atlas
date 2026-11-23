# Cloud storage: structure and reliability foundation

Source-only follow-up to `db59b9e`. No cloud data was deleted, moved, uploaded, re-encrypted or downloaded. No credentials were accessed. No APK, mobile/production build, deployment or push was performed.

## Storage structure

The audit found that the implemented native storage already has the needed separation. Existing keys, IDs, encryption envelopes and public URLs are preserved; there is no required wipe/migration for this change.

| Bucket | Existing prefix | Purpose |
| --- | --- | --- |
| Public | `galleries/originals/` | Explicitly approved public original copies |
| Public | `galleries/previews/` | Separate public preview derivatives |
| Public | `atlas/catalog/current.json` | Versioned public catalog entry point |
| Public | `atlas/catalog/revisions/` | Immutable catalog revisions |
| Public | `atlas/catalog/publications/` | Immutable trip publication records |
| Private | `encrypted/photos/`, `encrypted/videos/`, `encrypted/files/` | Encrypted originals |
| Private | `encrypted/previews/` | Encrypted preview derivatives |
| Private | `encrypted/catalog/library/` | Encrypted library records and recovery index |
| Private | `encrypted/catalog/gallery-ai/` | Encrypted Gallery organisation/AI recovery records |

Trips and places are relationships in metadata records/public placements. They do not require copying an original into another folder every time it is used. Existing public/private deduplication and explicit public-copy approval remain in place. Place labels and AI corrections belong in versioned metadata records; embedding edits in original bytes would invalidate original-file checksums. Private organisation must not be projected into the public catalog automatically.

## Implemented changes

- Cloud Storage defaults to **Originals**. **Previews & system files** is an inspectable separate view. Unknown legacy keys stay available; classification does not infer MIME types by downloading files.
- Support records cannot be selected for ordinary bulk deletion. Native single/batch raw-object deletion also blocks recovery catalogs and managed previews. Dedicated Gallery/Publish lifecycle code continues using its existing APIs. Public catalog and published-original deletion protections remain in place.
- Switching buckets resets upload consent, so approving an encrypted private upload cannot become approval to publish a public copy. Original selections remain available for a new review.
- Each bucket retains its own applied prefix, cursor and loaded pages. Editing the draft prefix does not change a continuation request. New folder loads replace previous results; overlapping page keys merge without duplicate rows/byte counts.
- Listing snapshots are discarded when the configured bucket scope changes. A generation check prevents an old in-flight listing from repopulating that scope after replacement/disconnection. Displayed totals explicitly remain loaded-page totals, including support-file bytes for storage-cost estimates.
- `getTransferProgress({ids})` optionally projects a requested set of at most 250 native UUID transfer IDs. Omitted input retains the full-history API; an empty set returns an empty result. One-ID requests use that transfer's WorkManager tag and return only its safe record. The native sealed history is still read; this is not a transfer-database migration.
- Trip publishing polls only its current transfer. Existing durable queue IDs, approved selections, original verification, resumable multipart state and publication records are reused.
- A cancelled/cancelling transfer exits publication waiting even if the Android worker is still unwinding. Android time-limit stops get explicit guidance. No automatic deletion, publication or retry loop was added.

## Validation

- `npm test`: **533 passed**, zero failures.
- Focused R2 TypeScript tests: **25 passed**. Includes layout classification, applied-prefix pagination, page deduplication, verification/recovery and cancellation while a worker is still running.
- `npx tsc --noEmit`: passed.
- Targeted ESLint: zero errors; six existing raw-image warnings in the storage/publisher components.
- `R2_LIBRARY_ONLY=1 node tests/r2/cloud-queue-browser.mjs`: mobile library fixture passed. Covers original/support separation, disabled support deletion, public/private token isolation across bucket switches, edited draft-prefix continuation and fresh public approval after private approval.
- `node tests/r2/cloud-queue-browser.mjs`: transfer queue fixture passed.
- `node tests/r2/trip-publisher-browser.mjs`: publisher fixture passed. Its mocked bridge now rejects any progress poll that requests the entire history, and tests durable retry/resume, verification, native batch reuse, final publication and mobile layout.
- `git diff --check`: passed.

Native test cases were added for support-object classification and selective repository projection. They were **not compiled or executed**: Android/Gradle builds remain deferred at the user's request. Native plugin compilation, real R2 operations, credential rotation, Android background behavior and device performance need validation when builds/device testing resume. Browser fixtures use synthetic native/storage responses and perform no personal cloud operations.

This pass does not introduce cloud-wide garbage collection or a new original-byte format. It does not scan an external hosted trip database for references after device loss. Existing catalog/local publication reference checks are preserved; arbitrary remote deletion is not a substitute for unpublishing through Creator Studio. A future reset/migration should first inventory objects and verify recoverability rather than treat existing originals as disposable by default.
