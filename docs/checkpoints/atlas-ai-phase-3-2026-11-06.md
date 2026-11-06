# Phase 3 checkpoint — partial, inference not verified

## Runtime and model blockers

No native inference runtime was added or claimed working. The Android SDK/NDK is not configured in this workspace. A request to the upstream GitHub API to resolve llama.cpp release b5046 returned proxy `403 Forbidden` (tunnel denied). That candidate release was not reviewed or pinned. No alternate route bypassed the network policy. No model was downloaded, and no real inference, emulator run, Android compilation or physical-device validation occurred.

The previous native bridge continues to return explicit runtime-unavailable errors. Its existing offline voice implementation is unchanged and remains physically unverified. No Supabase, cloud inference, paid service, production access or server authorization bypass was added.

## Implemented

- `src/lib/atlas-ai/context.ts`: bounded conversation context assembly, selected memories only, personality as untrusted style context, exclusion of action receipts, regeneration ending at the latest user request, explicit oversized-message/memory errors. The character budget is not a tokenizer guarantee; the future JNI implementation must enforce actual token limits.
- `src/lib/atlas-ai/model-catalogue.ts`: immutable model-entry schema and validation of repository/revision, GGUF filename, digest shape, size/context limits and license provenance URL. Immutable download URL construction and installation space budgeting. These are structural checks, not proof of artifact authenticity. The production catalogue is empty, and lookup rejects all installation requests. No fabricated checksum or approved model is present. Native download progress/cancellation, atomic installation, selection/removal and load-time verification remain unimplemented.
- `src/app/secret/atlas/page.tsx`: uses bounded context assembly and offers regeneration when a real native runtime reports available. Existing encryption and deterministic action gateway are preserved. No model output is simulated.
- `tests/atlas-ai/context.test.ts`: regeneration/privacy selection, context bounds and closed catalogue tests.

## Keystore

No key migration, wrapping activation or rotation was performed. Existing passphrase-derived encryption, ciphertext and encrypted exports/imports remain intact. Safe Keystore activation requires a staged wrapper with passphrase fallback, successful unwrap/decrypt verification before activation, cancellation/invalidation tests and Android execution. Those conditions cannot currently be demonstrated.

## Validation

Three new focused tests pass. TypeScript noEmit passes. Targeted ESLint, mobile bundle and diff checks were run; see session output for completion. Previous phase verification is recorded separately and is not represented as native inference evidence.

## Exact path to running on the phone

The current APK cannot generate language-model responses; development prerequisites remain, so there is no honest install-only procedure yet.

1. Provide permitted access to upstream llama.cpp metadata/source and the selected model repository/license/LFS metadata through the environment network policy. Resolve and review an immutable llama.cpp commit; record evidence. Obtain authoritative SHA-256, exact byte size and immutable revision for a compatible 0.5B instruct GGUF; verify its license. Do not use synthetic test digests.
2. Configure Android SDK 34, an appropriate pinned NDK/CMake toolchain and Gradle dependencies. Implement ARM64 JNI integration against that reviewed commit, with tokenizer/chat-template handling, streaming, cancellation, bounded context, cleanup and low-memory behavior.
3. Implement native app-private downloading with explicit consent, free-space checks, temporary-file streaming, SHA-256 verification, atomic promotion, cancellation and removal controls. Only verified files may become loadable.
4. Build the mobile assets (`npm run build:mobile`), sync Capacitor (`npx cap sync android`) and compile the Android preview variant (`cd android && ./gradlew assemblePreview`) once native dependencies are configured. Do not replace an installed production app or clear its data. Use the distinct preview application ID for initial testing.
5. Install that preview APK on the target ARM64 phone. In its model manager, explicitly consent to the reviewed model download, wait for integrity verification, select/load it and test token generation and cancellation in airplane mode. Record model digest, runtime commit, peak memory and timings without logging prompts.
6. Validate microphone permission denial/cancellation, installed offline recognition/TTS, Music interruption, headphones/Bluetooth and background cleanup on the phone. Validate Keystore recovery in an isolated fixture before offering activation for existing encrypted conversations.

All pre-existing uncommitted work was retained. No commits, pushes, deployment, production-data changes or destructive migrations occurred.
