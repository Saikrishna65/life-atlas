# Atlas project guide

Snapshot: 28 November 2026, implementation baseline `454b22b`. Start with [handover instructions](START-HERE.md). This document explains the system; [repository map](REPOSITORY-MAP.md) indexes exact files and older specialist notes.

## 1. Architecture and runtime boundaries

```text
Public browser                        Atlas Android (com.lifeatlas.app)
Next.js public pages                  bundled React UI + offline router
trip films / globe / journals         Gallery / Music / Finance / Trips / AI
              |                                      |
Next.js API routes                    Capacitor native plugins
Prisma / PostgreSQL                   MediaStore / SQLite / Keystore
public content + server services       WorkManager / foreground transfers
              |                                      |
public R2 catalog/media                direct signed R2 networking
explicit published copies              encrypted private originals/indexes

New account recovery backend: Google OAuth -> owner session -> encrypted escrow
Currently web app-data only; not yet a native R2/account recovery replacement.

Separate Atlas Video APK               Atlas Video browser at /video
NewPipe fork / com.lifeatlas.video      youtubei.js search + YouTube embed
```

### Stack verified in source

- Next.js **16.3.6** App Router, React **19.2.8**, TypeScript 5, Tailwind CSS 4.
- GSAP, Lenis, Three.js, globe.gl/react-globe.gl, Framer Motion; Leaflet/react-leaflet for maps.
- Capacitor **6.2.2** with Java/Kotlin/native C++ integrations. Do not assume framework versions from an old prompt.
- Prisma **5.22.0** and PostgreSQL for server-side public records and relevant backend services.
- `files-sdk` with Neon adapter for the older server-managed file system; **distinct from Android-native Cloudflare R2**.
- IndexedDB for many local application records; Android encrypted SQLite/files for native Gallery and other state.
- Official AWS SDK signing for native R2; Tink streaming authenticated encryption for private media.
- llama.cpp/JNI CPU runtime for optional local GGUF chat; separate Gallery vision/OCR/face inference.

### Web versus packaged Android

`npm run dev` starts Next on **3001**, not 3000. Production runs Next API routes and public data queries. `/secret/*` is a route family, **not proof of server authentication**.

Android uses `mobile/bootstrap.ts`, `mobile/App.tsx` and adapters for `next/navigation`, `next/link`, images and dynamic imports. `scripts/build-mobile.mjs` bundles these with esbuild into `mobile-dist`; it is not the same as running the public Next site inside the app. Capacitor uses local HTTPS Android content. `src/lib/appNetwork.ts` rewrites selected packaged-app API requests to the deployed origin; do not assume every relative fetch is automatically rewritten.

`src/proxy.ts` keeps recognized native requests on app/API routes. Native plugins must be registered in Android, have a matching TypeScript bridge and enforce their own input/access boundaries. A browser fixture with mocked Capacitor is not a native implementation test.

The main package remains `com.lifeatlas.app`; app label is Atlas. Current Android source version is **2.4.1 / code 49**, min SDK 22, compile/target SDK 34; individual features require newer APIs. A legacy variant retains `.next`. Installed-device package/signature must match for an in-place upgrade.

## 2. Public website

### Current composition

`src/app/page.tsx` reads published section configuration and parallel queries, then renders `TripFilmHero` and `LivingWorld`. Homepage revalidation is 300 seconds in source.

The long design conversation changed direction several times. **The current hero is the trip-film hero**, not a request to reinstate the earliest opening-door hero. It shows curated/latest trips and supporting Gallery/globe/latest-trip content. Later sections include the globe/observatory, “My life, collected” curved media ribbon, “People along the way,” the trip archive (“My roads & my stories”), and the closing-door homecoming. Inspect `LivingWorld` for current conditional composition.

Preserve the accepted hero, interactive globe and closing-door behavior unless explicitly asked to modify them. Global branding uses Atlas; public copy is first person singular (“I/my”). The user rejected generic repeated cards, unsolicited labels/section-number divider strips, too much blur, cream hero text, broken loaders and excessive gaps. Curated empty collections should remain empty/hidden, not silently acquire dummy media.

### Trip detail rules

- A valid trip can contain only images/videos. Do not invent an itinerary, route, distance or dates.
- Optional sections render only when real data exists.
- Trip has its own selected hero photo/video, places and media grouped by place.
- Globe marks the trip location; trip-detail maps mark places and an available actual route.
- Route framing should initially fit the full route. Do not draw a fake direct line and present it as traveled GPS data.
- Galleries mix photos and videos, allow place filtering, mobile swiping and dismissible viewing. User wants all trip media accessible without an “unfold more” gate.
- Photo metadata/captions are not required for every image; place details belong in the opened viewer rather than repeated captions below every tile.
- Actual playback depends on source encoding/browser support. Autoplay restrictions remain real; no autoplay sound.

### Publishing path

Creator Studio and native R2 publication explicitly select public media. Published originals/copies and catalog entries are distinct from private encrypted files. Website readers do not need R2 credentials. Catalog validation, cache-aware revisions, consistent object URLs and public bucket CORS matter. Canonical server public records and the native public R2 catalog are related but separate systems; trace the route being used rather than assuming they are one database.

A number of older server APIs are deliberately denied by `sensitiveApiDenial`. In particular, older Studio/Control Room documentation can describe a workflow that is now quarantined server-side. Fix ownership/authentication before enabling one; do not remove the guard to make the UI appear successful.

## 3. Atlas Trips and Creator Studio

Private trip routes live under `/secret/vault`, despite the user-facing Atlas Trips name. Features include itinerary/planning, checklist/packing, documents, bookings, budgets/money, reminders, food/rentals, memories, safety and route recording. Public websites receive only explicitly approved fields/media.

Creator Studio (`/secret/studio`) creates past trips with minimal required data and lets the user organise named places before assigning their photos. It manages homepage hero trips, ribbon media, People selection and archive order. It supports selecting a trip cover. Drafts, uploaded media and publication completion are distinct states.

Keep persistent selections and completed uploads across a catalog conflict or “finish later.” Do not ask the user to reselect every file or upload verified duplicates. Review native `R2TripQueue`, `R2PublicationSession`, `R2Publication`, `R2Catalog` and `src/lib/studio` when debugging.

Recorded GPS fixes are filtered natively (`ExpeditionFixFilter`) before deriving telemetry. Historical reports of walking at 100 km/h and bike speeds at 500–600 km/h motivated these safeguards. Do not trust raw GPS jumps or substitute guessed altitude/speed for missing measurements.

## 4. Atlas Gallery

### Product expectations

A consumer photo app, not a developer dashboard. Accessible local photos/videos, clear albums/places/favourites, full-screen viewer, familiar gestures, minimal controls and consistent centred sheets. Preserve Android-selected-photo permission limits. “All accessible media” does not mean bypassing permissions or reading every private app directory.

User preferences established through iterations:

- Mixed-size square-based grid without accidental full-width single-item columns; a previous pinch-to-change-grid feature was explicitly removed.
- Pinch/double-tap zoom in the **viewer**, smooth horizontal paging including videos, swipe-down dismissal with return-to-thumbnail motion.
- Swipe up shortcut to WhatsApp; use the existing native share implementation and handle WhatsApp unavailable.
- Controls hide on inactivity/interaction and reappear on tap; back arrow, consistent info/more sheets, appropriate bottom video controls/actions.
- Independent subpage scroll/history. Back from a photo/collection must not eject the user from Gallery.
- Good visible thumbnail quality, bounded caches, remembered high-quality assets, configurable preview quality. Do not replace every thumbnail with full-resolution originals to mask slow loading.

Both React viewer/motion code and `GalleryNativeViewerActivity` exist. Identify the active launch path before changing gestures; editing a fallback component may not affect Android's active viewer.

### Organisation and AI

- EXIF coordinates/imported metadata support radius-based suggested places; user can rename, add/remove photos and attach a place to a trip.
- Classification/OCR/embeddings/corrections are stored locally rather than recomputed every time a page opens.
- OCR uses the Latin/English path; the dedicated Hindi/Devanagari recognizer was removed by request.
- Optional CLIP-like image/text embeddings support semantic search, combined with local filename/text/date/place/trip intent handling. It is not just text OCR and not an unrestricted visual chat model.
- Incremental search, cancellation, hot caches and bounded results avoid stale responses and WebView memory spikes. Large-library approximate-nearest-neighbor indexing is not established as complete.
- Similar-photo groups and best-shot choices do not automatically delete originals. Quality picks are recommendations, not guaranteed human judgments.
- Face grouping is optional; people can be named, merged/corrected and separated. Misidentification remains possible. Corrections are persisted preferences/index information, **not proof that a neural network is fine-tuned on the device**.
- Smart albums, anniversary memories, extraction/OCR/sticker tools, Takeout import, favourites and local/cloud trash are separate features with different data ownership.
- New-media observation/discovery is constrained by Android scheduling and permissions. Do not promise real-time analysis 24/7 after force-stop.

AI jobs respect resource budgets, opted-in model downloads, charging/network settings and cancellation. Model files, embedding indexes, cached previews and originals are different storage categories; avoid duplicated disk copies. No broad deletion of “cache” directories that actually contain only copies of recoverable metadata.

### Native source centres

Under `android/app/src/main/java/com/lifeatlas/app/r2/`: `R2DeviceGallery`, `R2GalleryPreview`, `GalleryPreviewSettings`, `GalleryNativeViewerActivity`, `GalleryIntelligence`, `GalleryIntelligenceWorker`, `GallerySearchStore`, `GallerySearchInference`, `GallerySearchHotCache`, `GalleryCorrections`, `GallerySimilar`, `GalleryFaceModels`, `GalleryCollections`, `GalleryAlbums`, `GalleryRecovery`, `GalleryRecoveryWorker`, `GalleryExtractionService`, `R2GalleryLocations`, `R2TakeoutWorker`.

Web/native bridges and display caches are in `src/lib/gallery`; components in `src/components/gallery`. Read the current bridge types before changing native results.

## 5. Atlas Music

Local music import/library, albums/artists/playlists, queue, playback, themes, metadata, downloads and Android playback/media integrations. Import supports many file extensions; actual decoding still depends on Android/browser codec support. A file picker filter should not silently exclude valid formats.

Playback state is shared through `MusicPlayerContext`; do not remount the player on every page transition or eagerly load the entire Music feature at app startup. Library snapshots and widget refreshes are coalesced. Shuffle uses a linear algorithm; sleep timing uses a deadline rather than needless repeated work. Metadata “verification” should perform real checks, not a cosmetic delay.

Video-to-Music handoff is for explicitly selected audio downloads; no duplicate standalone audio-download subsystem in the Video fork. Source/provider restrictions and network errors must remain visible. Server Music endpoints may be quarantined; do not confuse local playback with working cloud authorization.

## 6. Atlas Finance

Use **Atlas Finance**, not Finance Vault, in user-facing text. Core domain/application/storage layers live in `src/lib/finance`; React presentation in `src/components/finance`.

Functions include accounts, transactions, categories, budgets, goals, recurring entries/subscriptions, bank-notification review, reporting, monthly review, shared-expense groups/splits and repayment matching. Bank capture is Android notification access with supported message parsing—not arbitrary access to bank servers. User review can assign category and a roommate split in one workflow.

Important accounting invariants:

- Money arithmetic, transaction validation, balances and linked records belong in domain/application services, not ad hoc UI math.
- Shared purchases and incoming repayment matching update related financial records atomically.
- Roommate repayments must not count as salary/earnings. The real bank debit/credit remains recorded.
- Partial/overpayments, edit/unmatch/delete/reversal and linking an existing manual settlement must not double-settle a balance.
- Monthly review distinguishes spending changes, subscriptions and unusual transactions; missing information is not a fraud finding.
- Snapshot caches accelerate display only. Authoritative mutations re-read/version-check actual data.

The owner commonly shares expenses with one roommate. Prioritize simple selection during transaction review over a complex group setup requirement for every payment.

## 7. Atlas AI, local models and voice

Atlas AI combines existing deterministic commands/action routing with optional actual local model inference. It is **not a trained proprietary LLM** merely because corrections or custom settings exist.

`src/lib/atlas-ai` contains policies, adapters, action registry, memory/storage, personality and Lab interfaces. Native plugins include `AtlasLocalAIPlugin`, `AtlasModelsPlugin`, model download/store/runtime classes and `android/app/src/main/cpp/local-ai`. Intelligence Lab is `/secret/control-room/intelligence`.

Local runtime: pinned llama.cpp source, JNI, CPU GGUF inference, bounded model/context/thread settings, streaming/cancellation, lazy loading and idle/memory/thermal handling. Verified model catalogue exists; no GGUF weights are bundled in the APK. Models are stored in native no-backup files, not passed through JS or ordinary backups.

The Lab provides model library/import/download, playground, configurations and synthetic comparisons. A built runtime or synthetic fixture is **not evidence of real model quality/speed on the phone**. Existing reports specifically distinguish compiled tests from real inference and record unavailable weight downloads. Do not invent a “best model” benchmark.

Assistant-generated actions still pass schemas, permission policies and confirmation boundaries. Model text is not proof that an action ran. Optional cloud providers are separate, explicit paths. Installing Atlas Video does not automatically give the LLM access to that app; inter-app permissions/protocols are separate work.

### Voice activation

Two experimental directions exist: current custom microphone wake listener and a Google/Gemini accessibility bridge. User wants to toggle/test them; defaults and resource ownership are in the implementation notes. The bridge observes assistant UI; it does not obtain privileged DSP integration or guarantee zero drain. Google may hear/act on speech first, overlay classes change, mic handoff is uncertain and lock-screen rules apply. Keep log-only diagnostics free of conversation/secrets and test narrow events on the actual Moto. Do not run competing microphone owners.

The phone was unavailable, so real battery endurance, OEM/background behavior and reliable 24/7 wake response are open validation items.

## 8. Atlas Video and Atlas Apps

### Browser

`/video` is independent of the cinematic travel site's navigation/loading wrapper. `/secret/video` is the packaged/private-route counterpart. Components and services live in `src/components/video`, `src/lib/video`; API routes provide search, autocomplete and channels.

Features include compact bottom navigation/search, themes, debounced suggestions, cancellation and stale-response suppression, paginated/scroll-driven results, opt-in topic discovery, channel browsing and persistent-in-session mini-player. Search infrastructure uses `youtubei.js`; browser playback uses a YouTube embed. It is **not the NewPipe playback engine in a browser**, and cannot promise ad-free playback or remove embedded provider branding.

Privacy requirement: no persistent search/watch history. Explicit theme/settings/topic choices are not watch history. Keep result/player state transient; do not add persistent query caches as a speed fix. External YouTube requests retain provider privacy/availability behavior. Historical fixture tests blocked external playback; live streaming must be tested separately.

### Separate Android Video

Source in `/workspace/atlas-video`, NewPipe v0.29.3 base. Package `com.lifeatlas.video`; retains GPL-3.0-or-later obligations. Fork notes describe no-history behavior, Mono/Paper/Ink themes, bottom controls, YouTube-only service boundary, optional feature switches and Atlas Music handoff. SoundCloud/Bandcamp/PeerTube/media.ccc.de were not wanted. Do not strip upstream licenses/notices to make it “look proprietary.”

### Apps hub and icons

`/secret/apps` can discover/open/install a trusted published companion. Package/version/hash/signature and source archive checks matter. It cannot silently install an APK. Existing docs state no validated first Atlas Video release feed/APK was published; verify releases rather than guessing a URL.

Gallery/Music/Finance direct launcher entries are ways into the same main app, not necessarily independently installed APKs. Custom app icons/launcher aliases and self-update support exist. Updating requires the same signing identity and valid increasing version; do not solve a package conflict by instructing uninstall when there is local-only data.

## 9. Storage, encryption and backups

There is no single complete backup today. The previous conversation's initial short backup explanation omitted some later automatic-native capabilities; this section incorporates the Gallery library implementation.

| System | Source of truth | Recovery / limits |
| --- | --- | --- |
| Local app data | IndexedDB stores for Trips/Music/Finance/Studio/preferences | Separate from media bytes referenced by content URI or file path |
| Native secrets | Android Keystore-wrapped no-backup records | Not recoverable by assuming Android device backup migrates keys |
| Native private R2 originals | Tink streaming-encrypted files + encrypted library index | Requires original key identity and configured private bucket |
| Gallery organisation | Native encrypted analysis/corrections + optional encrypted recovery snapshots | Match originals by checksum; restoring metadata does not download originals |
| Public R2 | Explicitly published media and versioned catalog | Public, not a substitute for private backup |
| Legacy app-data cloud | `src/lib/cloud-vault`, server Files storage | Recovery-code architecture; legacy endpoint currently quarantined |
| New account app-data cloud | `/api/account/[action]`, encrypted server escrow | Web foundation only; requires configured Google/backend |
| Manual `.atlasbackup` | Selected Trips/Music/Finance snapshots | Passphrase-encrypted, optional embedded media, 64 MB limit; legacy/expert route |

### Native R2 security and transfers

Public and private credentials are separate, entered in Android and stored with Keystore encryption. Signing and byte streams remain native. Credentials must not enter public URLs, logs, IndexedDB, ordinary exports or Vercel merely because the website needs media.

R2 buckets used by the owner are `life-atlas-public` and `life-atlas-private`. Do not include access keys in documentation. Endpoint overrides are validated, not arbitrary signed HTTP destinations.

Private media uses established Tink streaming AEAD, authenticated metadata and checksums. Private keysets are independently recoverable; newer flows include an unpassworded **sensitive recovery file**, older flows include password-wrapped kits. Both are key material, not harmless settings exports. Latest account plan does not yet eliminate these requirements.

Transfers use WorkManager/foreground execution, bounded concurrency/retries, progress, multipart state and native file streams. Original bytes are preserved; previews are separate derivatives. A 100% byte counter can precede verification/catalog completion. Pause/finish-later must retain selected media and completed work. “Uploaded & ready,” “published” and “backed up with durable index” are different states.

### Automatic native library backup actually exists

Gallery Library has opt-in automatic private backup with selected albums/types, unmetered/charging preferences, verified recovery requirements and periodic native discovery (documented hourly). Android can defer or stop work. This is separate from the JS app-data backup loop and from Gallery AI organisation backup.

After a private upload is verified, append-only encrypted recovery index records are committed under `encrypted/catalog/library/`. Index restore reconstructs the library; originals load/download separately. Gallery organisation recovery uses `encrypted/catalog/gallery-ai/`. Restored unmatched analysis waits for matching original bytes; existing local corrections are retained. Optional face restore has separate consent.

Cloud trash keeps originals until explicit permanent removal. Tombstones prevent resurrection from older snapshots. Phone trash uses Android's consented APIs. Neither trash path should delete public website copies or unrelated originals automatically.

### Account foundation specifics

Google code flow verifies the configured owner's email via authenticated Google userinfo. Server records use stable Google subject identity. Secure HttpOnly host cookies have a thirty-day expiry; requests require matching Origin plus a custom header. Purpose-bound AES-GCM protects account sessions/recovery records.

Server escrow lives under `atlas-system/accounts/<subject-hash>/recovery-v1.json`, serialized with PostgreSQL advisory locking. Master-key loss is a real operator recovery risk. The new endpoint permits only the authenticated account's vault; it does not make other `/api/*` routes authenticated.

The existing web cloud client persists its connection (including encryption secret) locally. This is not yet native secure-session/key custody. Do not advertise the current web foundation as completed end-to-end Android account security.

Account restore currently replaces saved app-data sections after confirmation. Gallery organisation recovery merges matching information. A unified restore must deliberately reconcile these different semantics.

## 10. Authentication and safety boundaries

Local optional authentication is controlled centrally under Control Room. Default-off controls are a user preference, not server identity. Native `security/AtlasSecurity` and its plugin enforce enabled scopes. Old assistant phrase-protected data has explicit legacy recovery paths; do not erase it because new assistant storage opens automatically.

Sensitive server routes deliberately return 403 through `src/lib/security/api-authorization.ts`. Check call sites before diagnosing a 403 as network failure. Origin/header checks are CSRF defenses, not ownership. Public site and private app must remain separated by actual data authorization, not obscurity of `/secret`.

Never log model prompts, credentials, private media URLs/paths, face data or bank messages as performance telemetry. Never run reset/signing/admin/test-data scripts casually; names are not guarantees of safety.

## 11. Performance work already done

The user repeatedly reported slow loads, flicker, blurred previews and unsmooth gestures. Keep measuring rather than claiming “instant.” Recent changes:

- Lazy route/module loading and bounded session caches; retain valid visible data while refreshes run.
- Shared trip snapshots/widget updates and event-driven Finance pending counts.
- Gallery prioritises current visible requests, avoids stale speculative work and bounds rendering/cache/concurrency.
- Shared refresh scheduling retains trailing changes instead of losing them during an in-flight read.
- Visibility-aware polling stops UI status work while hidden, with no overlapping requests. **Native transfer/analysis jobs are not paused merely by hiding their progress UI.**
- Music uses cached library reads, coalesced widgets, linear shuffle and one-shot sleep deadline.
- Control Room's general automatic backup engine is dynamically loaded only when enabled.

Recent implementation commits: `412aafa`, `2806c2e`, `007eca9`, `642f780`. The latter measured an isolated source module graph reduction (53,691 → 6,062 bytes); this is not APK size or phone startup timing. Finance notes contain their own fixture-specific measurements. No current physical-device performance/battery conclusion is established.

Avoid adding idle polling for features not open, scanning whole stores for badges, retaining full-resolution video in JS, starting AI at boot, speculative model downloads, or persistent query history under the label “cache.”

## 12. Development and validation

### Fresh setup

1. Clone the main repo and inspect `AGENTS.md`, branch and working tree.
2. Install dependencies from the lockfile with `npm ci` (requires network/package availability).
3. Use `npm run dev` on port 3001 for browser work. Public DB/API behavior needs actual configured backend or synthetic fixture data; don't insert demos into production.
4. Prisma uses `DATABASE_URL`. The older server file adapter has its own server storage configuration (`AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in relevant checks). These are not the user's Android R2 credentials.
5. `NEXT_PUBLIC_MOBILE_API_ORIGIN` controls the packaged app's service origin; default is the existing Vercel address. Never put secrets in NEXT_PUBLIC values.
6. New account backend needs `ATLAS_ACCOUNT_ORIGIN`, `ATLAS_ACCOUNT_EMAIL`, `ATLAS_GOOGLE_CLIENT_ID`, `ATLAS_GOOGLE_CLIENT_SECRET`, `ATLAS_ACCOUNT_MASTER_KEY`. See its dedicated setup document; do not generate a replacement master key over existing escrow.

### Checks allowed while builds are paused

```sh
npm test
npx tsc --noEmit
npx eslint <files-you-changed>
git diff --check
```

`npm test` executes `tsx --test tests/**/*.test.ts`. Native tests and browser scripts are separate. Browser scripts under tests generally use source fixtures; read them for dependencies and side effects. Some older scripts expect generated artifacts or databases.

At baseline `454b22b`: 678 JS/TS tests passed, TypeScript passed, new account-code lint passed. Scoped lint of the older cloud client exposed existing `any` violations; do not claim repository-wide lint is clean. Those results are historical validation, not a rerun performed by this documentation change.

### Build reference — DO NOT RUN until requested

- Web production: `npm run build` runs Prisma generation then Next build.
- Packaged UI: `npm run build:mobile`; Capacitor copy/sync then Gradle for Android.
- Native AI docs specify JDK 17, SDK/platform 34, NDK `27.2.12479018`, CMake 3.22+; verify actual Gradle requirements before installation.
- Tests under `android/app/src/test` and instrumentation under `android/app/src/androidTest` have different execution requirements. Compiling instrumentation is not executing it.
- Review `.github/workflows` before push/workflow dispatch; several workflows build APKs. Don't trigger them against the user's pause.
- Model weights are not in Git. Reproducible source does not mean ready inference without downloads and consent.

### Validation claims and release rules

Use distinct labels: source checked, unit tested, fixture-browser tested, native unit tested, compiled, APK packaged, installed, physical-device tested, live cloud tested. A success in one does not imply the next.

Do not run personal R2 uploads, destructive migrations, seed/reset scripts or live account restore just to verify code. Use isolated datasets and explicit provider test configuration. Don't publish signing private keys. Read `mobile/INSTALL-UPDATE.md` and update/signing docs before releasing.

A push to main can update Vercel; verify actual deployment separately. Android changes never reach the phone from a Vercel push alone. The in-app updater needs a correctly signed published artifact/manifest, not just source in Git.

## 13. Troubleshooting map

| Symptom | First checks |
| --- | --- |
| App not installed / package conflict | Package variant, signing certificate, version code, other Android users/profiles; preserve data; don't tell user to uninstall by default |
| Catalog conflict during trip publish | Current catalog ETag/revision, conditional write path, queue/selection durability; don't re-upload all photos |
| Upload stalls after 100% | Verification/index/catalog stage, persisted transfer status, WorkManager constraints and network; bytes sent is not final publication |
| Per-file authentication | Native scope policy and publication-batch lifetime; do not remove all authorization guards |
| Gallery smart search closes app | Native logs with sensitive content redacted, bitmap/model memory, cancellation/resource ownership; spinner changes alone won't fix process crashes |
| Viewer blink/slow opening | Active native vs React viewer, preview→original transition, cached image lifecycle, shared-element source geometry |
| Scroll position leaks across pages | `mobile/navigation.tsx`, `mobile/scroll-restoration.ts`, Gallery layer history and per-subpage keys |
| Public loader hangs | Critical-only readiness, failing media, timeout/error behavior; don't block page on every offscreen original |
| Video search slow | Upstream deadline, request count, cancelled/stale responses and server timing; no persistent history cache |
| `/api/*` returns 403 | `sensitiveApiDenial`, proper owner session and endpoint policy; never bypass guard as a UX fix |
| Account setup unavailable | Server OAuth/allowlist/master key configuration; no native flow yet |
| New device has catalogue but no photos | Index vs original restore distinction, file permissions, matching keyset/bucket, restore queue |
| Vercel font error | Local font configuration/assets, installed Next version and build logs; avoid dependence on remote font downloads |

## 14. Work that should remain visibly pending

- Complete unified native account backup/recovery and verify a genuinely independent new-device restore.
- Securely transfer/publish the separate Atlas Video fork and a trusted release if requested.
- Real Moto testing of gestures, media decoding, EXIF permissions, AI latency/quality/memory, background jobs and battery.
- Google bridge/wake microphone comparisons on the actual phone; no “Google-equivalent” claim yet.
- Actual local LLM responses and representative benchmarks where documentation still records missing real models/device evidence.
- Review server ownership before unquarantining legacy endpoints.
- Audit stale docs/screenshots/test artifact paths as work progresses. `work/` and generated APKs/screenshots may be ignored/local and missing from fresh clones.

Keep this guide and the specialist docs updated when any of those boundaries change.
