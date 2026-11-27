# Optional native local inference checkpoint

## Scope

The AtlasLocalAI Capacitor plugin now calls an optional JNI-backed llama.cpp CPU engine. Standard builds do not compile or fetch the engine. No cloud fallback or model downloads are enabled by this change. The bundled reviewed model catalogue remains empty.

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
2. Review and add a small Gemma-compatible GGUF entry with actual immutable repository revision, byte count, SHA-256, and license. Do not invent any values or bypass the empty catalogue.
3. Install the preview on a device. In airplane mode test genuine text generation, repeated requests, cancel during load/prefill/decode, unload, pause, lock, invalid/corrupt models and low-memory behavior.
4. Measure cold start, first token latency, generation throughput, peak RAM, thermal and battery use before changing context size, caching, or sampler defaults.
5. Run existing Android, web and privacy regression suites. No training, merge, export, release or main-branch change is part of this checkpoint.

## Actual verification in the current environment

The Java JNI UTF-8 decoder was compiled with javac and its standalone test passed all 35 byte-split boundaries and byte-by-byte streaming. This is not an Android integration test. Full repository clone and upstream source download are blocked by DNS; Android SDK and NDK are absent. No native compilation, APK build, or GGUF inference was executed.
