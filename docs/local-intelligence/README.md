# Atlas local intelligence

Implementation branch: `feature/atlas-local-intelligence`. Baseline `3015c56` preserves all six local commits ahead of the fetched `origin/main` (`29c42b6`). No merge into main, push, deployment or personal-data upload is part of this change.

## Audit and runtime decision

The original `AtlasLocalAI` bridge provided real offline STT/TTS but explicitly had no inference engine. Its reviewed model catalogue was empty. Existing typed actions, confirmation/lock-screen policies, encrypted assistant storage, personality settings, native voice coordinator, audio ownership and optional consented cloud providers were reusable. None of the public hero, globe, R2 storage, gallery recognition models or vault databases needed replacement.

We reviewed [llama.cpp Android guidance](https://github.com/ggml-org/llama.cpp/blob/a6ac41c757c066941766164439f6876f2deaab04/docs/android.md), [ggml](https://github.com/ggml-org/ggml), [PocketPal](https://github.com/a-ghorbani/pocketpal-ai) and [ExecuTorch](https://github.com/pytorch/executorch). Native llama.cpp fits the requested GGUF library without adding a React Native/JSI runtime or a PyTorch model-export pipeline. PocketPal is a reference, not a copied implementation. ExecuTorch remains an alternative for separately exported models. GPU/NPU backends are not compiled or advertised as working.

CMake downloads one immutable llama.cpp archive with SHA-256 verification:

- Commit: `a6ac41c757c066941766164439f6876f2deaab04`.
- Archive SHA-256: `2696af3883b799a31102b1ce2c107212286d0e5219143dbfb8edc70cd52f17a2`.
- CPU only, mmap, four threads, 2048 context tokens, 128 response tokens, temperature 0.7, top-p 0.9 by default.
- ARM64 and x86_64 libraries; native AI requires Android 8/API 26 or newer. The existing app minimum remains unchanged; the JNI loader fails safely on older Android.
- Optimized native compilation, adaptive user-selected thread/context limits, no model loaded at startup, cancellable loading and inference.
- One process-owned engine/worker shared by Capacitor chat and native voice. Model switching cancels/unloads the old model first.
- Upstream Jinja templates with input marking. User text is tokenized without treating it as template control tokens. Explicit reviewed overrides are available. Thinking defaults off; native spoken chat forces it off.
- Context overflow drops older messages while retaining the system and latest request; an oversized latest request fails explicitly.
- Default idle unload after 120 seconds. Configurable 30–1800 seconds or keep-resident mode. Memory pressure still unloads. UI-hidden alone does not cancel background voice. Severe thermal events cancel inference. No idle polling timer runs when no model is resident.
- New native library is linked for 16 KB page alignment. This does not certify unrelated pre-existing native dependencies.

## Model storage and provenance

Weights stay under Android `noBackupFilesDir/atlas-models`; they never enter IndexedDB, localStorage, a WebView blob, ordinary backups or source control. Downloads require explicit license/data consent and use pinned HTTPS URLs, host-checked redirects, resumed byte-range validation, exact size and SHA-256 checks, then atomic same-filesystem promotion. Paused downloads retain partial bytes after process restart. In-process connection failures retry up to five times (six attempts total) with 1/2/4/8/16-second backoff, honoring numeric Retry-After up to 120 seconds. Each attempt rechecks the requested network type and resumes valid byte ranges. Process restart still requires explicit resume; Android process termination is not an uninterrupted-upload guarantee. Imports stream from Android's document picker with byte progress and cancellation and compute their own hash; unknown publishers/licenses are clearly unverified. Interrupted imports are discarded on the next process start; originals remain untouched.

A calculated import hash establishes local file identity, not publisher trust. Imported GGUFs are native parser inputs and must come from a trusted source. Architecture/template/memory failures must not become a false Ready state. The first load/selection verifies the full hash; subsequent verification in the same process uses the app-owned file size/mtime cache.

Eleven downloadable artifacts have exact LFS digests/sizes and immutable upload revisions, mirrored in `android/app/src/main/assets/atlas-model-catalogue.json` and `src/lib/atlas-ai/lab/verified-models.json`, with a consistency test. [The complete twelve-candidate review](MODELS.md) lists exact filenames, links, hashes, licenses, quantizers, architecture qualifications and free-space requirements. Arcee Lite 1.7B remains disabled because its exact artifact identity could not be verified. No actual model inference or best-model recommendation has been established here.

## Intelligence Lab

Open **Control Room → Intelligence Lab** (overview or Access tab). It is a lazy route in both Next.js and the offline Capacitor app.

- Library: model/architecture/quantization search, installed filter, explicit Wi-Fi download, pause/resume, native import, activation and confirmed removal, progress and free-space information.
- Playground: existing personality settings plus custom system instructions, streaming, cancellation, regenerate, copy, offline speech input/output and actual response metrics. Conversation content is session-only.
- Configuration: threads, context, response length, batch, sampling, seed, template and thinking controls, residency, idle timeout and streaming. Unsupported GPU offload is rejected, not silently ignored.
- Compare: 100 distinct synthetic cases, balanced ten-case quick suite, custom prompts, conversation contexts, structured tool proposals, selected-model sequential evaluation, warm-up, repeated measurements, medians/spread, cold initialization data, manual 1–5 ratings, configurable weights, JSON and CSV export.
- Automatic tool scores validate both the production schema and expected arguments. Benchmarks never import live vault adapters or execute proposed actions.
- The last five synthetic benchmark reports are kept in app-private no-backup files, limited to 4 MB each. Custom prompts are not auto-persisted. Manual ratings can be saved explicitly.
- Missing subjective/resource measurements remain missing. Overall comparisons are provisional; missing weights remain in the denominator. Thermal/battery efficiency is not inferred from short runs. PSS sampling is a process-wide observation, not isolated model RAM.

Existing deterministic assistant actions still run first. Flexible foreground local replies use constrained JSON, production schema parsing, the existing action registry, lock checks and confirmations. A model proposal is never treated as a successful action. Cloud fallback remains the existing opt-in path. The Lab itself never substitutes cloud inference.

Native Hey Atlas can invoke the same engine without an active WebView, with bounded session history. Locked sessions do not include earlier unlocked conversation history or fetch vault data. JavaScript session memory is replaced across each lock/unlock boundary. Native screen-off handling clears unlocked history and stops that session; fresh keyguard checks precede model-generated actions and spoken replies. Existing native command handlers run first; otherwise the background LLM provides chat, not arbitrary native tool execution. The sentence gate suppresses reasoning blocks/structured output and queues completed sentences through the existing TTS owner. Follow-up listening starts after generation and the speech queue finish. Session termination cancels its own generation. Lab voice refuses competing audio ownership rather than starting a second microphone.

## Desktop runner

With CMake 3.22+, Ninja and a C++17 compiler:

```sh
cmake -S android/app/src/main/cpp/local-ai -B /tmp/atlas-ai-build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build /tmp/atlas-ai-build --target atlas-cli atlas-core-test -j 4
ctest --test-dir /tmp/atlas-ai-build --output-on-failure
npx tsx scripts/local-ai/export-cases.ts /tmp/atlas-quality-cases.json
python3 scripts/local-ai/bench-desktop.py --cli /tmp/atlas-ai-build/atlas-cli --model /path/to/verified.gguf --cases /tmp/atlas-quality-cases.json --output /tmp/atlas-real-benchmark.json --quick
```

The CLI accepts JSONL `load`, `generate`, `reset`, `unload`; it emits streamed token events and measured terminal results. The benchmark script uses only Python's standard library and never downloads weights. On Windows use an appropriate CMake generator/configuration and `atlas-cli.exe`; Windows execution has not been verified here. Keep desktop reports separate from phone rankings.

## Validation boundaries

See `VALIDATION.md` for executed checks and `DEVICE-TESTS.md` for the phone test sequence. This environment is Linux. No physical-device or emulator inference result is claimed. Hugging Face workspace downloads are blocked by the managed egress policy; a network-policy change request did not complete. Metadata was reviewed through the research connector, but no model weights were obtained and no real model response or throughput benchmark ran.

Remaining limitations: Arcee Lite artifact identity needs verification; retries are bounded and process-restart downloads require explicit resume; interrupted imports require reselection of the untouched source; CPU only; no Windows validation; full native/JNI behavior, voice quality, background endurance, actual model memory/temperature/battery results and signing compatibility with the installed phone build need device verification. Native background chat uses bounded session context; persistent memory selection and richer tools remain in the existing foreground assistant. Short benchmark runs cannot rank battery efficiency. Larger imports are capped at 3.5 GB for this initial phone-oriented implementation.

## Android build prerequisites

Use JDK 17, the existing Android platform/build tools 34, NDK `27.2.12479018` and CMake 3.22 or newer. Install missing SDK packages using Android Studio/SDK Manager. Then run `npm run build:mobile`, `npx cap copy android`, and `./gradlew assembleDebug testDebugUnitTest` from `android/`. The build fetches the pinned C++ source archive, never model weights. Reuse your trusted signing configuration for an installable update; this branch does not distribute a private signing key. `ATLAS_NATIVE_BUILD_DIR` optionally places generated CMake files outside the project on constrained build machines. No Vercel configuration is required.

## Completion validation additions

`AtlasModelStore` reports import progress/cancellation through the existing Library poll; no full model crosses JavaScript. Production transfer tests exercise broken streams, HTTP retry, range restart, checksums, low storage and canceling pending retry. Storage fixtures are not executable models. Selection, deletion and inference admission share a serialized native gate; settings changes reject while that gate is occupied. Thermal status is rechecked for resident models too.

Voice diagnostics use `android.elapsedRealtime` events for recognition completion, router entry, native load, prompt processing, first generated token, the sentence gate, TTS enqueue/start/completion and follow-up recognition readiness. The old `firstSentenceMs` remains a punctuation estimate. TTS start is an Android callback, not an acoustic measurement. Events are timing-only, bounded to 64, and visible in the existing voice diagnostics. No transcript, cloud secret or vault content is added to timing records.

Cold initialization captures load wall time and the first observed streamed token separately from warm generation. JSON and every CSV row carry runtime/model digest/device/configuration; CSV includes prompt versus generation throughput and punctuation-estimate labeling. Missing metrics stay unavailable. Benchmarks remain proposal-only and never execute tools.

The runtime retains a single mmap-backed model/context with bounded CPU threads, lazy loading, explicit cancellation, memory-pressure unload and idle residency controls. KV content is cleared per request: cross-request prompt caching is intentionally disabled so stale session/private tokens cannot become an implicit context source. Reusing the allocated context avoids repeated context allocation while actual chat history is supplied explicitly. No Vulkan/NPU support is claimed.

See [Windows emulator and actual JNI instructions](WINDOWS-TESTS.md). The optional `AtlasRealModelTest` requires an actual app-readable GGUF and skips explicitly when absent; compilation is not test execution. `verify-model.py` checks supplied files without modifying them. `smoke-native.py` exercises actual host output and records failures; it is ready for supplied weights but has not run real inference here.
