# Atlas AI phase 2 — 2026-11-06

This checkpoint supersedes the earlier Supabase identity decision. There is no account authentication or Supabase integration in the active security boundary. Sensitive online APIs always return a no-store denial; native unlock never authorizes Neon/cloud access.

## Implemented and verified locally

- **A — encrypted conversations:** multiple sessions, create/rename/search/delete, timestamps, automatic saves, paged history display, lock/unlock, encrypted export and non-overwriting merge import. Separate IndexedDB database `life_atlas_ai_local_v1`; no existing module schema changes. AES-256-GCM with random 96-bit IVs and PBKDF2-SHA256 (600,000 iterations, random 128-bit salt); titles, chat, memories and personality are all encrypted. No persisted key or plaintext fallback. Keys remain in memory only while unlocked. Explicit user-held passphrase recovery; no reset mechanism. Browser visibility/pagehide and native app-state listeners lock the vault.
- **B — memory:** explicitly saved, searched, edited and deleted separately from chat; no automatic memory capture or synchronization. Users choose memories for each response; generated-message metadata records referenced memory IDs. The current saved memory is shown by ID, so edited memory text can differ from the version originally used. Deleted memories leave active retrieval immediately. Old encrypted exports, old IndexedDB storage pages and quotations in chat are not securely erased by this operation; import of an old archive can explicitly restore old memories.
- **D — interface:** responsive Atlas page, searchable sessions, floating launcher and expandable orb/panel, idle/listening/thinking/speaking/error styling, reduced-motion CSS, theme variables and editable encrypted Personality Studio. Existing navigation is retained; the mobile route map includes `/secret/atlas`.
- **F — local adapters:** bounded typed actions with separate read/control/write grants; native device authentication on every request and again before mutation confirmation. No browser-auth fallback. Music local search/play/pause/resume, downloaded-only queue skip, playback state and playlist opening; Finance balances/recent summaries/categories, expense proposals and categorization via existing services; Trip search/itinerary reading/opening and itinerary-day title proposals. Financial and Trip writes require immutable, session-bound, expiring single-use confirmation. Rechecks reject stale snapshots, lock/revocation and restore overlap. Receipts are stored encrypted in the conversation; a receipt-storage failure after mutation explicitly tells the user the action already completed.
- **G — privacy boundary:** no arbitrary model tool execution, scripts, shell, free-form URLs or direct database tools. Model text cannot invoke adapters. No AI bank transfers/payments, cloud actions, private uploads or production operations. Browser module access is deliberately denied because no verified native trust exists there. Earlier recovery/backup/startup changes remain in place.

## Runtime status — blocked, no generated AI claims

**C is not complete.** This repository has no llama.cpp JNI/CMake runtime, pinned Android binary or GGUF artifact. The registered native bridge reports unavailable and rejects generation; the TypeScript consumer supports request-filtered token events, cancellation and listener cleanup for a future runtime. No model downloads or cloud inference are enabled. The UI saves user messages encrypted and explicitly reports model unavailability; it never substitutes synthetic replies.

Evaluation: llama.cpp with an Android NDK/JNI bridge is appropriate for GGUF CPU inference. Start with a 0.5B instruct model, such as Qwen2.5-0.5B-Instruct in Q4_K_M; consider 1.5B only after profiling the 8 GB target device. Model size, quantization, license, context/KV cache and runtime ABI must be verified together. Next integration needs a reviewed/pinned native runtime, an immutable model catalogue with verified SHA-256, explicit download consent, atomic app-private installation, load/unload/low-memory handling and device profiling. No checksum or inference output was invented.

## Android voice and key protection limitations

**E is implemented in source, not device-validated.** `AtlasLocalAIPlugin` uses Android 12+ `createOnDeviceSpeechRecognizer` only when available, explicit microphone permission, visible foreground listening states, on-device result events and cancellation. It never calls the generic potentially online recognizer. TTS selects an installed non-network voice for the current device language and rejects unavailable voices. Audio focus is requested; Music is paused before voice starts and is not automatically resumed. Voice stops on backgrounding, focus loss, cancellation and audio-becoming-noisy events. Permission callbacks and late recognition results are cancellation-guarded. Headphone/Bluetooth routing uses Android system routing; actual devices must verify it. No wake word or background microphone service exists.

Conversation encryption currently uses a user-entered passphrase on both browser and Android WebView. **It is not Keystore-backed.** Android Keystore wrapping/auth-bound crypto remains a separate unimplemented hardening step, requiring export/recovery and key-invalidation tests before changing storage keys. Existing keys and records were not rotated. Native biometric verification uses the installed `BiometricAuthNative` plugin directly with strong authentication/device-credential fallback, bypassing the application's permissive browser helper.

## Verification

- **68 focused tests passed**, zero final failures, across 12 test files: Atlas storage/gateway/adapters/native contract/sandbox; security foundation; backup recovery/Control Room; cloud roundtrip; Music Vault; Finance persistence; Trip storage.
- Storage tests cover reopen, ciphertext-only exports, wrong passphrase, tampering, merge preservation, pagination/search, concurrent serialization, interrupted transaction rollback and stale-window denial.
- Gateway/adapters tests cover permissions, trust denial, revocation during awaits, immutable action binding, expiry/replay/session denial, local Music controls, confirmed expense creation/categorization, balance preservation, Trip edits and stale-edit denial.
- **Mobile Chromium smoke passed**, all requests fulfilled from local build assets or denied: encrypted setup, chat/memory persistence, restart unlock, search, memory deletion, orb collapse, mobile overflow and no page errors.
- **TypeScript `--noEmit --incremental false` passed. Targeted ESLint passed. `git diff --check` passed.** Existing unrelated/baseline lint errors were not re-audited or rewritten.
- **`npm run build:mobile` passed**, 121 assets. Android manifest XML parsed successfully.
- Android APK compilation, physical biometric/microphone/TTS/Bluetooth tests and actual model inference were **not performed**. No Android SDK is configured for this session; no runtime/model dependency was downloaded. The native-contract test checks source invariants only.

Useful commands: `node --import tsx tests/atlas-ai/storage.test.ts`, corresponding gateway/adapters/native-contract tests, and `npm run build:mobile`. Optional browser smoke: `node tests/atlas-ai/mobile-smoke.mjs` (requires Playwright and system Chromium; no application network traffic is allowed by the fixture).

## Preservation and next phase

All pre-existing uncommitted work was preserved except the explicitly superseded authentication path, which was replaced with unconditional denial. No commits, pushes, deployments, production reads/writes, destructive migrations, paid services or large model downloads occurred. No existing Music/Finance/Trip records or cryptographic key material was migrated. Explicit local chat/memory deletion is user-confirmed. New Atlas data is not included in legacy cloud snapshot collection.

Next: integrate and profile the pinned Android llama.cpp runtime and verified small model; validate Android voice/biometrics/audio routing; then introduce Keystore protection with tested passphrase-export recovery. The local encrypted notebook, memory and deterministic module tools work now; natural-language AI generation remains unavailable until that native runtime phase is completed.

## Phase 2 files

Created:
- `src/lib/atlas-ai/storage.ts`
- `src/lib/atlas-ai/gateway.ts`
- `src/lib/atlas-ai/local-adapters.ts`
- `src/lib/atlas-ai/native.ts`
- `src/app/secret/atlas/atlas.module.css`
- `src/components/secret/AtlasLauncher.tsx`
- `android/app/src/main/java/com/lifeatlas/app/AtlasLocalAIPlugin.java`
- `tests/atlas-ai/storage.test.ts`
- `tests/atlas-ai/gateway.test.ts`
- `tests/atlas-ai/adapters.test.ts`
- `tests/atlas-ai/native-contract.test.ts`
- `tests/atlas-ai/mobile-smoke.mjs`
- This checkpoint.

Modified:
- `src/app/secret/atlas/page.tsx`
- `src/app/secret/layout.tsx`
- `src/lib/security/api-authorization.ts`
- `tests/security/foundation.test.ts`
- `mobile/App.tsx`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/lifeatlas/app/MainActivity.java`
