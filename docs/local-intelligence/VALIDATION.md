# Validation report — 24 November 2026, completion pass

Branch: `feature/atlas-local-intelligence`; this pass continues `b616c33`. Implementation commit: `e964bb9`. No architecture replacement, main merge, remote push, deployment or personal-data upload was performed.

## Updated artifact

- [Atlas 2.4.1 debug APK](../../work/local-intelligence/atlas-2.4.1-local-ai-debug.apk), `com.lifeatlas.app`, code **49**.
- Size: **56,952,358 bytes** (54.3 MiB).
- APK SHA-256: `1cf5fd348935b1ddbe74494a718d0f54e12c72ce705a82a1b70e6e309dd15f7b`.
- Signing certificate SHA-256: `f396d14bbd2076769e0edb46a3a8c4a4d4d45b57ae90a0ddd70e226e65d2d36f`.
- `apksigner verify --print-certs` passed; certificate matches the earlier workspace APK. Installed-phone signing compatibility has not been checked.
- Both ARM64 and x86_64 `libatlas_llama.so` are packaged, with `0x4000`/16 KB ELF LOAD alignment. No GGUF weights are bundled.
- [Compiled instrumentation test APK](../../work/local-intelligence/atlas-2.4.1-local-ai-instrumentation.apk). Signature verification passed. **Tests were not executed on an emulator or phone.**

## Completed gaps

- Native import now returns a transfer identifier immediately and exposes byte progress, unknown-size progress, cancellation and safe failure cleanup in the existing Library. Content streams stay native and originals remain untouched. The implementation uses long byte counts and a bounded 128 KiB buffer; actual multi-GB device I/O has not been measured.
- Interrupted downloads automatically retry up to five times with exponential backoff, recheck network preferences, resume validated byte ranges, and respect numeric Retry-After up to 120 seconds. A process restart or exhausted retry window still requires explicit resume. Low-storage failures retain usable downloaded partials. Corrupt partials cannot become installed models.
- Selection/removal/inference admission are serialized; selection cancels pending inference. A severe thermal state prevents a new request even when a model is already resident.
- Native session history is cleared when the screen turns off; an unlocked in-progress session stops and resumes the already-configured wake listener through the existing policy. Fresh keyguard checks protect replies/actions. JavaScript sessions are replaced across lock/unlock boundaries, discarding old turns, summaries, pending confirmations and vault references. Wake-word thresholds were not changed.
- Voice telemetry records recognition, router, native model load, prompt processing, first generated token, first speakable sentence, TTS enqueue/start/completion and follow-up recognizer readiness. The existing diagnostics display these timing-only events. **TTS start is a callback; no acoustic latency was measured.** The older `firstSentenceMs` is still a punctuation estimate.
- Cold load wall time/first observed streamed token and warm generation are separate. JSON and CSV carry runtime, model digest, device and configuration. CSV also separates prompt/generation throughput and labels punctuation estimates. Missing ratings/measurements remain unavailable/provisional; benchmarks do not execute tools.
- [Eleven exact catalogue artifacts](MODELS.md) now have pinned revisions, sizes, digests and licenses. Architecture/quantization support was checked against the pinned CPU source. Arcee Lite 1.7B stays disabled because exact artifact identity/provenance could not be verified.
- Added supplied-file verification, a real-output host smoke runner, optional real-model JNI test, and [reproducible Windows instructions](WINDOWS-TESTS.md).

## Executed validation

| Check | Result and scope |
|---|---|
| Full JavaScript suite | **546 passed, 0 failed, 0 skipped**, `npm test` |
| TypeScript | `npx tsc --noEmit` passed; production build type check also passed |
| Scoped ESLint | Passed: Atlas AI libraries, Lab, voice bridge, existing Atlas AI diagnostics page and Lab regression tests |
| Android JVM/Robolectric | **217 passed, 0 failed, 0 skipped**, including existing wake-word/R2/security/gallery coverage |
| Transfer regressions | Actual Java state machine with synthetic bytes/HTTP transport: truncated body→Range retry, HTTP503 recovery, server ignoring Range→restart, corruption rejection, low-storage retry, cancel pending retry, import progress/cancel. Fixtures are **not executable LLMs** |
| Privacy/schema regressions | Session lock-boundary reset; injected permissions/confirmation, arbitrary tools, path traversal and malformed finance proposals reject |
| Native host | CMake build and CTest passed: configuration, missing files, safe cleanup and real upstream chat-template rendering |
| Actual native negative smoke | Missing-file load and generation-without-model reject, then unload completes. No fabricated model response |
| Mobile bundle | Passed, **199 assets**; optional Lab remains lazy-loaded |
| Production build | Passed; compile **13.2 s**, TypeScript **21.8 s** in this environment. Existing Prisma content fetches logged unavailable-database errors and followed existing fallbacks; no website data was modified |
| Browser | Actual Chromium at **390 px** and **1280 px**: 11 catalogue entries, search, safe native-unavailable controls, tabs, 100 cases, settings, no horizontal overflow or page errors |
| Android build | `testDebugUnitTest assembleDebug assembleDebugAndroidTest` passed; native libraries linked for both ABIs; actual JNI test compiled |
| Packaging | App and test APK signatures passed. App package/version and ELF alignment inspected |
| Python runners | Syntax compilation passed. A missing supplied model correctly produces an incomplete error report, never synthetic inference |
| Whitespace | `git diff --check` passed |

Repository-wide ESLint was not represented as clean: the previous pass recorded pre-existing unrelated failures (154 errors/189 warnings). This pass ran and passed the relevant scoped lint above.

## Actual inference and emulator status

**No actual GGUF weight inference was possible.** No user-provided model, local model cache or attached Windows environment was available. Managed egress rejected Hugging Face weight requests; the targeted network-change confirmation did not complete, so no policy changed. Publisher metadata was readable through research tools but those tools were not used as a weight-download bypass. No verified alternative publisher weight host was obtained. [MODELS.md](MODELS.md) provides exact authorized downloads, filenames, hashes, storage requirements and local import instructions.

The host native engine was really compiled and executed for negative/template tests. This is not successful model generation. Real streaming, generated structured outputs, model quality, model-switch behavior with weights, memory cleanup under load and quick benchmarks remain **unverified** until a supplied GGUF is tested. No throughput, ranking, first-token, RAM, thermal or battery result is invented.

**No emulator or physical-device execution.** This Linux environment has no `/dev/kvm`, installed emulator or AVD, and insufficient available space for the official emulator/system image plus extraction/userdata. API36 ATD image + Linux emulator require 1,098,660,853 bytes even compressed. Software emulation still needs installed image files. The exact capacity evidence and Windows reproduction steps are in `WINDOWS-TESTS.md`. `AtlasRealModelTest` skips explicitly without a provided modelPath; a skip or compilation must not be described as real inference passing.

No Motorola installation, microphone handoff, locked TTS, screen-off endurance, overnight/battery test, large device file I/O or acoustic measurements occurred. Existing endurance/baseline features remain in place for the phone's return. GPU/Vulkan/NPU support remains unimplemented/unclaimed. Imports after process death require reselection of the preserved source, downloads have bounded recovery, and imported unknown models still require trusted provenance.

## Evidence and next verification

- [Actual mobile browser preview](previews/lab-mobile.png) and [desktop preview](previews/lab-desktop.png): native-unavailable mode, not phone screenshots.
- [Architecture and completion notes](README.md).
- [All twelve model candidates / exact checksums](MODELS.md).
- [Windows emulator + actual-model JNI/host commands](WINDOWS-TESTS.md).
- [Phone tests](DEVICE-TESTS.md) and [changed files](FILES.md).
