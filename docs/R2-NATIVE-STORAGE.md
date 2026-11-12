# Native R2 storage

## Audit and scope

Life Atlas uses Next 16 / React 19, a bundled offline Capacitor 6 Android app,
IndexedDB vaults, native device authentication, SAF export, and existing backend
cloud sync. This integration is a separate native storage path. It does not
replace existing databases, ordinary backups, music sync, authentication, or the
Android assistant. The public hero, its frames/timelines, and globe are unchanged.

Native sources live in `android/app/src/main/java/com/lifeatlas/app/r2/`;
`src/lib/r2/` defines the bridge, types and credential-free public catalog reader;
`src/components/cloud-storage/` contains the Control Room workspace. The public
`PublishedMedia` scene and photography route browse approved catalog records.

## Set up on Android

1. Build/install the bundled Android app (Android 8+ for this feature), with a
   secure device screen lock. Open Control Room → Cloud Storage → Connections.
2. Enter the Account ID and each bucket's separately scoped Object Read & Write
   access/secret keys. Defaults are life-atlas-public and life-atlas-private.
   Standard endpoints derive automatically; EU/FedRAMP overrides must match the
   same account. Enter the public HTTPS custom domain or r2.dev base URL.
3. Save each bucket. Confirm the native Android authentication prompt. Password
   fields clear; saved keys are never returned to JavaScript. Test each connection
   explicitly: HEAD bucket, unique synthetic upload/readback/SHA-256/delete.
4. For private uploads, open Recovery. Export a passphrase-encrypted kit using a
   unique passphrase of at least 16 characters. Store it independently of the
   phone, then reopen it with Verify / restore. Private uploads stay disabled
   until this succeeds. New devices must import the SAME kit.
5. In Library, choose the public/private boundary and select originals using the
   Android photo or document picker. Providers must grant lasting URI access.
   Approve the review and queue uploads. Large files stream natively, with
   multipart uploads above 32 MiB and persisted part ETags. Nothing enters a
   JavaScript whole-file buffer. Temporary staging needs sufficient device space.
6. Browse pages/prefixes, search/filter/sort loaded records, inspect metadata,
   request photo previews, download originals through SAF, and explicitly delete.
   The displayed storage estimate covers loaded object bytes, not an entire
   unmeasured bucket or an R2 billing report. Its USD/GB-month rate is editable.
7. To publish an encrypted private object, choose Prepare public copy. Android
   authenticates, downloads and decrypts locally. Approve a separate public upload.
   Optional JPEG/PNG/WebP EXIF/XMP removal changes metadata without re-encoding
   pixels. Other formats retain metadata or need an externally sanitized copy;
   they are never silently transcoded. Private originals are not modified.
8. After the public copy is verified, choose Publish to Website. Review title,
   description, tags, collection and category; approve disclosure. Share the
   generated catalog-enabled website link. Unpublish removes the catalog entry
   and deletes the separate public object. Previously cached copies cannot be
   recalled. If deletion fails, the UI explicitly says the object may remain public.

## Security and recovery

The native bridge accepts calls only from the HTTPS localhost bundled app.
Sensitive operations use Android device authentication inside the plugin; the
legacy web guardian PIN does not authorize these operations. Credentials are
separate bucket records, encrypted with Android Keystore AES-256-GCM in
`getNoBackupFilesDir()/r2`. Neither ordinary app backups nor IndexedDB receive
these records. Capacitor logging and WebView debugging are disabled. R2 requests
use the official AWS SDK SigV4 signer, TLS, account-bound endpoint allowlisting,
no redirects, fixed safe error codes and no credential-bearing public URLs.
Hardware backing is reported only when Android KeyInfo reports it.

Private file encryption uses Tink AES256-GCM-HKDF streaming AEAD (1 MiB segments).
A versioned authenticated container holds the original filename, MIME, byte size
and SHA-256. Its object key is associated data. Original file bytes are recovered
only after authentication and checksum verification. No private thumbnail is
uploaded in plaintext. Recovery kits wrap the independent Tink keyset using
PBKDF2-HMAC-SHA256 (600,000 iterations), random salt and AES-256-GCM. They contain
no R2 token. Wrong or different kits never silently replace the current key.

Keystore invalidation fails closed. The native reset operation only resets
unreadable R2 state, quarantines its ciphertext, and requires reconfiguration and
the independent recovery kit. Remote objects remain untouched. Local vaults are
outside this reset. Lost multipart IDs may need cleanup in Cloudflare. Do not
assume a phone backup can restore Android Keystore keys. Automatic private vault
backups are intentionally disabled; uploads are explicitly selected files only.

## Transfers and publishing

WorkManager runs one foreground transfer at a time with connectivity constraints,
bounded exponential retries, progress, pause/resume and soft cancellation that
preserves other queued jobs. Original uploads are read back and SHA-256 checked
before completion. Multipart recovery reuses the locally persisted staged bytes
and part ETags. Native signing/networking keep keys outside WebView after setup.
Android may stop or defer work; force-stop/device migration cannot guarantee
uninterrupted uploads. Cancellation can require connectivity to finish remote
cleanup. Local originals are never deleted because a cloud request failed.

Public copies use collision-resistant `galleries/originals/` keys; optional small
previews use `galleries/previews/`. Private keys are under `encrypted/photos/`,
`encrypted/videos/` or `encrypted/files/`. Filenames are metadata, not paths.
Catalogs use immutable `atlas/catalog/revisions/` documents plus a conditionally
written `atlas/catalog/current.json` (If-Match / If-None-Match). Current manifests
have a short cache TTL; originals/revisions are immutable cached objects.
Conflicting writes preserve the existing current catalog. The reader validates
schema/version, size, unique IDs, MIME types, paths and same-base public URLs.

### Public discovery limitation

A credential-free website cannot discover an arbitrary new bucket without a
public address. The app supplies it via `?atlasCatalog=https...` in the share link;
the browser retains only this nonsecret source URL. Canonical visits without an
address or prior selection use existing local assets. Catalogs need public HTTP
access and CORS allowing the website origin for GET/HEAD; configure that bucket
policy in Cloudflare if it is not already present. No R2 secrets or Vercel env
variables are required. A universal canonical-site registry is not implemented.

## Validation and remaining device work

Use `npm test`, `npx tsc --noEmit`, scoped ESLint, `npm run build`,
`npm run build:mobile`, `npx cap sync android`, and Android Gradle
`:app:testDebugUnitTest --tests 'com.lifeatlas.app.r2.*'` / `:app:assemblePreview`.
Robolectric tests exercise native Java policy, real Tink encryption, recovery,
tampering, encrypted local state and XML rejection. They do not establish real
Android Keystore hardware, biometric UX, provider permissions, live R2 access,
4K transfer reliability or process-kill behavior on a physical phone. Those need
an installed build, a device and user-entered credentials; no personal data is
uploaded by repository checks. Preview APKs use the existing debug signing setup,
and are not a production-signed release. The existing release signing setup
also needs the owner's production signing process before distribution.

### Results from this implementation session

- TypeScript, production Next build, offline mobile bundle and Capacitor sync: pass.
- JavaScript suite: 345 passing tests, including original hero preservation.
- Scoped ESLint: no errors; six image-element warnings are for native/on-request
  previews and public CDN objects that intentionally bypass Next's image proxy.
- Native plain-JUnit tests: 3 passing (endpoint/key boundaries, multipart sizing,
  redacted errors, official AWS signing scope and public/private separation).
- Native Java compilation and `assemblePreview`: pass; preview APK generated.
- Seven Robolectric encryption/recovery/secure-store cases are present, but did
  not execute: downloading its Android runtime redirects to a Maven mirror
  denied by this environment's network policy. These are not passing tests.
- Chromium: catalog loading, public search, mobile overflow and Android-only
  credential boundary pass; no page exceptions in that run.
- No device/emulator or live R2 credentials were used. Biometric/picker/Keystore,
  live multipart/cancellation, large 4K uploads and process-death recovery still
  need device acceptance testing. This is not a production-readiness signoff.
- Library totals cover loaded pages; a full-bucket inventory/billing integration
  is not implemented. Catalog discovery and CORS limitations are described above.
