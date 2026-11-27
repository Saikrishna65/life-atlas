# Optional native local inference checkpoint

## Scope

The AtlasLocalAI Capacitor plugin now calls an optional JNI-backed llama.cpp CPU engine. Standard builds do not compile or fetch the engine. No cloud fallback is enabled. The catalogue now contains a published Gemma 3 1B baseline; downloading requires the native library and explicit revision-bound license and download consent.

- llama.cpp is pinned to commit a7a98e0fffed794396b3fbad4dcdbbc184963645 (b6500).
- Initial implementation targets arm64-v8a, 2048 context tokens, up to 512 generated tokens, four CPU threads, 128-token batches and mmap. Sampling is greedy for the initial smoke test. The model/context are released after each request; persistent caching and thermal tuning are not implemented.
- The existing textual conversation prompt is formatted as a single user message using the GGUF chat template. Proper separate role-based messages, template-specific behavior, and Gemma response quality need real-model validation.
- Each request is single-flight; cancellation interrupts hashing, model loading and CPU decoding. Generation requires a focused unlocked activity; pause/destroy request cancellation. No model path is supplied by JavaScript. The selected catalogue entry is resolved to private content-addressed storage and its size and SHA-256 checked before loading.
- Memory availability is screened conservatively, but cannot guarantee that native allocations will succeed.
- Runtime status reports candidate-file availability, not proof that the model has successfully loaded.

## Preview build (not run in the current environment)

On a checkout of feature/atlas-ai-integration, prepare the mobile web assets and Capacitor project using the existing repository build procedure. Install Android NDK 28.2.13676358 and CMake 3.22.1, then from android/:

```sh
./gradlew :app:assemblePreview -PatlasLocalInference=true
./gradlew :app:testPreviewUnitTest -PatlasLocalInference=true
```

On Windows use gradlew.bat. The opt-in build requires access to the pinned upstream repository, or a locally prepared source using standard CMake FetchContent override. Before distributing an APK, review the upstream license notices and model license/redistribution conditions. Do not deploy or merge this checkpoint until builds and inference pass.

## Verification gates still open

1. Build both default and opt-in variants and check arm64 native linkage, dependency notices, and Android compatibility including 16 KB pages.
2. Verify the baseline GGUF download, checksum rejection and model selection on a device. The source metadata is pinned below; the actual binary has not been downloaded or tested here.
3. Install the preview on a device. In airplane mode test genuine text generation, repeated requests, cancel during load/prefill/decode, unload, pause, lock, invalid/corrupt models and low-memory behavior.
4. Measure cold start, first token latency, generation throughput, peak RAM, thermal and battery use before changing context size, caching, or sampler defaults.
5. Run existing Android, web and privacy regression suites. No training, merge, export, release or main-branch change is part of this checkpoint.

## Actual verification in the current environment

The Java JNI UTF-8 decoder was compiled with javac and its standalone test passed all 35 byte-split boundaries and byte-by-byte streaming. This is not an Android integration test. Full repository clone and upstream source download are blocked by DNS; Android SDK and NDK are absent. No native compilation, APK build, or GGUF inference was executed.

## Baseline model metadata checkpoint

- Repository: ggml-org/gemma-3-1b-it-GGUF
- Revision: 61333bac858461ec0c309b7baafdc408d7d2c381
- Filename: gemma-3-1b-it-Q4_K_M.gguf
- Bytes: 806058240
- SHA-256: 8ccc5cd1f1b3602548715ae25a66ed73fd5dc68a210412eea643eb20eb75a135
- License: https://ai.google.dev/gemma/terms (review prohibited-use and redistribution obligations before distributing models or derivatives)
- Published pointer: https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/commit/61333bac858461ec0c309b7baafdc408d7d2c381

All nine static catalogue checks passed (single entry, id, repo, filename, exact revision, bytes, checksum, size limit, license). Native download and acceptance guards were inspected, not exercised on Android. Host Java UTF-8 test rerun passed 35 boundaries and byte-by-byte streaming. Git clone probe failed DNS; SDK/NDK absent. No model bytes downloaded, APK built, or inference run. Baseline is not a trained Atlas model.
