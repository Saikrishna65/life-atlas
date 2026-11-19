# Native upload duplicate detection

The foreground R2 upload worker hashes the prepared file and compares it with
verified upload history held in Android's encrypted no-backup secure store.
The serial WorkManager queue lets later files in the same batch reuse a copy
completed earlier in that batch. Filename/URI equality alone is never enough.

A candidate must be a verified, completed upload in the same public/private slot
and endpoint/bucket, with the same content hash, MIME type and metadata-removal
policy. Private matches also require the same encryption key ID. Plaintext hashes
of private originals stay inside native encrypted state; they are not emitted in
plugin summaries, logs, object keys or cloud metadata. Private ciphertext keeps
its existing object key, preserving Tink authenticated associated data.

The worker checks HEAD, streams the existing object through SHA-256 verification,
and only then atomically completes the new job as `reused`. It sends no media PUT
and creates no additional thumbnail. Existing trip metadata/publication identities
remain independent across trips. Within one trip, reuse retains the media ID to
avoid duplicate gallery entries. Transfer status reports “Already in cloud”.

Missing candidates allow a normal fresh upload. Network failures, corrupt copies
and cancellation never claim success. Multipart uploads already in progress are
not rebound. Cancellation cleanup cannot delete a shared reused object, and
pause/cancel operations atomically reject transfers that have just completed.
No existing cloud duplicate or local original is automatically deleted.

## Scope

This is exact-byte matching against this installation's recorded upload history,
not perceptual matching or an exhaustive bucket scan. Older public uploads with
recorded verified SHA-256 hashes are supported while their bucket identity can
be established. Legacy private uploads lacking original-content hashes and
random-key objects uploaded elsewhere cannot be identified automatically.
Changing devices or clearing app data loses this history. Credential rotation is
supported for records that contain an endpoint/bucket scope. Metadata-retaining
and sanitized copies remain distinct deliberately.

## Checks

- Native Robolectric tests exercise real secure-state persistence, digest
  verification, different names/identical bytes, different bytes/same names,
  bucket/slot/key/privacy isolation, missing/corrupt/offline candidates, multipart
  safety, interrupted verification, shared-copy cleanup and exact private
  decryption after reuse. All transport fixtures are synthetic; no real bucket
  is accessed.
- TypeScript tests cover the duplicate-check/reuse transfer messages and existing
  trip upload queue behavior. APK signing/version compatibility tests remain.
- TypeScript, scoped ESLint, native Java compilation and the mobile bundle.
- Physical phone/background restrictions and real user bucket behavior require
  validation on the phone. Tests never upload or delete personal data.
