# Phase 5 — native readiness checkpoint (2026-11-06)

## Current readiness

Branch remains `work`. No commit, staging, branch switch, push or workflow trigger occurred. Pending changes correspond to the prior recovery/security, Atlas UI/storage/adapters, Android model/voice/wrapper and preview-CI work. This phase changes only the preview workflow, build guide and this checkpoint. No application behavior, Neon configuration, keys, storage or API guards were changed.

No missing application source dependency was found by TypeScript and mobile bundling. The critical files are still untracked, including the workflow, native plugins, model catalogue asset, model-transfer JVM test, Atlas modules/components/tests and runtime pin manifest. A checkout of HEAD alone therefore does not contain the completed development work. Generated `mobile-dist`, `node_modules`, Gradle output and signing keys must not be committed.

## Provenance investigation

Fresh authoritative metadata requests both failed at the environment proxy with `Tunnel connection failed: 403 Forbidden`:

- `https://api.github.com/repos/ggml-org/llama.cpp/git/ref/tags/b5046`
- `https://huggingface.co/api/models/Qwen/Qwen2.5-0.5B-Instruct-GGUF?blobs=true`

Candidate to investigate: Qwen2.5-0.5B-Instruct GGUF, preferably Q4_K_M. Repository existence/current artifacts, exact filename, immutable model revision, license and file SHA-256/size were **not verified**. No value was inferred from a filename, ETag or example. Both production catalogues remain empty. The llama source manifest remains `revision: null`, `reviewed: false`; b5046 is only a lookup candidate, not an approved version. Network-policy access to these authoritative sources is still required. No alternate policy-bypass route or model download was attempted.

## Native/JNI boundary review

The existing workflow has a separate hard-disabled job that can fetch a reviewed 40-character commit, verify checkout identity and compile upstream ARM64 with pinned NDK 26.3.11579264/CMake 3.22.1, API 28. It currently builds only the `llama` library target, not an APK JNI library. Its build flags and target must be checked against actual pinned source before activation. The literal false guard was retained.

`AtlasLocalAIPlugin` currently reports runtime unavailable, rejects generation and has no-op inference cancel/unload. Its voice implementation is real source but unrelated to inference. There is no verified upstream header or JNI/CMake implementation to review, so no upstream API calls were added.

Smallest intended integration after source review:

1. Add `android/app/src/main/cpp/CMakeLists.txt` and a single JNI translation unit, linking the reviewed llama target into one ARM64 shared library. Verify the pinned header's model/context/tokenizer/chat-template/sampler and cleanup signatures first; do not invent those interfaces.
2. Keep one serialized Java inference worker owning model/context lifetime. Resolve only the selected app-private catalogue path, recheck bytes and SHA-256 before opening, and never accept a caller-provided arbitrary path.
3. Convert the existing bounded JSON conversation payload into role/content messages, applying the model's actual verified chat template and tokenizer. Character limits are not token limits. Enforce the model catalogue's context limit and reserve output tokens before decoding.
4. Preserve current `requestId` token events, max-output bound and cancellation contract. Deliver UTF-8-safe text; ignore callbacks after request cancellation/replacement. Release context/sampler/model resources on unload, background teardown, failure and memory-pressure notification. Model deletion must wait for unload completion.
5. Test a real verified GGUF through the worker before reporting `available: true`. The current no-op unload and byte-count limits are not sufficient evidence of inference readiness.

These are integration boundaries, not claims that JNI exists. Upstream header/API review remains blocked.

## Workflow update and validation

The manual preview job now runs `:app:testPreviewUnitTest` before `:app:assemblePreview`, with a 12-minute test timeout and a 50-minute job timeout. It checks the actual `AtlasModelTransferTest` JUnit XML for at least two tests and zero failures/errors/skips, so missing or skipped tests fail the job. The always-uploaded diagnostics now include raw JUnit XML, HTML reports and the dedicated Gradle test log. Production signing/deployment paths remain absent; APK identity still must equal `com.lifeatlas.app.next`.

Available checks: 17 focused Atlas/security tests pass; TypeScript noEmit passes; mobile bundling passes (121 assets); YAML/manual-trigger/read-only-permissions/native-disable/test-order checks, all embedded shell syntax and `git diff --check` pass. Actionlint and javac are unavailable here. The Android JVM tests have been scheduled in CI but have not run in this session. No Android compilation, emulator/device validation or real inference is claimed.

## Proposed commit plan — requires approval, nothing staged

Use a new development branch such as `dev/atlas-native-readiness` from the current `work` HEAD when authorized, retaining the working tree. Avoid old automatic-build branch patterns. Review/stage explicit paths or hunks, not `git add .`. Each group below is a proposed logical commit, not an executed command. Shared Android/launcher changes stay with their imported source dependencies. Recheck the inventory before staging so later unrelated edits are not swept in.

1. `fix: preserve local data and fail closed for sensitive APIs` — existing recovery/startup/backup compatibility and API-denial foundation. Validate backup, cloud roundtrip, Music/Finance/Trip and security tests.
2. `feat: add encrypted local Atlas and staged Android capabilities` — Atlas storage/memory/UI/actions, native voice/model management, disabled key-wrapper staging and focused tests. Validate TypeScript, focused Atlas tests and mobile bundling. Native source requires subsequent CI compilation.
3. `ci: build and test isolated Android previews manually` — preview workflow, empty reviewed-source pin and build/checkpoint documentation. Validate workflow and obtain explicit approval before any push or manual dispatch.

Exact pending paths by proposed commit (tracked modifications and untracked files):

### Commit 1

- `capacitor.config.ts` (modified)
- `docs/checkpoints/security-foundation-2026-11-06.md` (untracked)
- `src/app/api/cloud-vault/route.ts` (modified)
- `src/app/api/control-room/file/route.ts` (modified)
- `src/app/api/control-room/route.ts` (modified)
- `src/app/api/mobile/studio/route.ts` (modified)
- `src/app/api/music/route.ts` (modified)
- `src/app/api/music/stream/[id]/route.ts` (modified)
- `src/app/api/music/upload-url/route.ts` (modified)
- `src/app/api/music/youtube/route.ts` (modified)
- `src/app/api/upload/route.ts` (modified)
- `src/app/api/vault/ai/itinerary/route.ts` (modified)
- `src/app/api/vault/ai/parse/route.ts` (modified)
- `src/app/api/vault/export/route.ts` (modified)
- `src/components/secret/DataEpochGate.tsx` (modified)
- `src/lib/cloud-vault/clean-start.ts` (modified)
- `src/lib/cloud-vault/client.ts` (modified)
- `src/lib/control-room/backup.ts` (modified)
- `src/lib/music/storage.ts` (modified)
- `src/lib/security/api-authorization.ts` (untracked)
- `tests/cloud-vault/roundtrip.test.ts` (modified)
- `tests/control-room/backupRecovery.test.ts` (untracked)
- `tests/security/foundation.test.ts` (untracked)
- `tests/vault/musicVault.test.ts` (modified)

### Commit 2

- `android/app/src/main/AndroidManifest.xml` (modified)
- `android/app/src/main/assets/atlas-model-catalogue.json` (untracked)
- `android/app/src/main/java/com/lifeatlas/app/AtlasKeyWrapper.java` (untracked)
- `android/app/src/main/java/com/lifeatlas/app/AtlasLocalAIPlugin.java` (untracked)
- `android/app/src/main/java/com/lifeatlas/app/AtlasModelTransfer.java` (untracked)
- `android/app/src/main/java/com/lifeatlas/app/AtlasModelsPlugin.java` (untracked)
- `android/app/src/main/java/com/lifeatlas/app/MainActivity.java` (modified)
- `android/app/src/test/java/com/lifeatlas/app/AtlasModelTransferTest.java` (untracked)
- `docs/checkpoints/atlas-ai-phase-2-2026-11-06.md` (untracked)
- `docs/checkpoints/atlas-ai-phase-3-2026-11-06.md` (untracked)
- `docs/checkpoints/atlas-ai-phase-4-2026-11-06.md` (untracked)
- `mobile/App.tsx` (modified)
- `src/app/secret/atlas/atlas.module.css` (untracked)
- `src/app/secret/atlas/page.tsx` (untracked)
- `src/app/secret/layout.tsx` (modified)
- `src/components/secret/AtlasLauncher.tsx` (untracked)
- `src/components/secret/ModelManager.tsx` (untracked)
- `src/lib/atlas-ai/context.ts` (untracked)
- `src/lib/atlas-ai/gateway.ts` (untracked)
- `src/lib/atlas-ai/key-wrapper.ts` (untracked)
- `src/lib/atlas-ai/local-adapters.ts` (untracked)
- `src/lib/atlas-ai/model-catalogue.ts` (untracked)
- `src/lib/atlas-ai/native.ts` (untracked)
- `src/lib/atlas-ai/sandbox.ts` (untracked)
- `src/lib/atlas-ai/storage.ts` (untracked)
- `src/lib/atlas-ai/voice-session.ts` (untracked)
- `tests/atlas-ai/adapters.test.ts` (untracked)
- `tests/atlas-ai/context.test.ts` (untracked)
- `tests/atlas-ai/gateway.test.ts` (untracked)
- `tests/atlas-ai/mobile-smoke.mjs` (untracked)
- `tests/atlas-ai/native-contract.test.ts` (untracked)
- `tests/atlas-ai/phase4.test.ts` (untracked)
- `tests/atlas-ai/sandbox.test.ts` (untracked)
- `tests/atlas-ai/storage.test.ts` (untracked)

### Commit 3

- `.github/workflows/android-preview.yml` (untracked)
- `android/llama-source.json` (untracked)
- `docs/builds/android-preview.md` (untracked)
- `docs/checkpoints/atlas-ai-phase-5-2026-11-06.md` (untracked)
