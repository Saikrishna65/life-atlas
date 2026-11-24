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

Weights stay under Android `noBackupFilesDir/atlas-models`; they never enter IndexedDB, localStorage, a WebView blob, ordinary backups or source control. Downloads require explicit license/data consent and use pinned HTTPS URLs, host-checked redirects, resumed byte-range validation, exact size and SHA-256 checks, then atomic same-filesystem promotion. Paused downloads retain partial bytes after process restart. Resume is explicit; there is no automatic background retry loop. Imports stream from Android's document picker and compute their own hash; unknown publishers/licenses are clearly unverified. Interrupted imports are discarded on the next process start; originals remain untouched.

A calculated import hash establishes local file identity, not publisher trust. Imported GGUFs are native parser inputs and must come from a trusted source. Architecture/template/memory failures must not become a false Ready state. The first load/selection verifies the full hash; subsequent verification in the same process uses the app-owned file size/mtime cache.

Four downloadable artifacts are verified against publisher LFS pointers and immutable upload revisions. Their full hashes, byte sizes and provenance are mirrored in `android/app/src/main/assets/atlas-model-catalogue.json` and `src/lib/atlas-ai/lab/verified-models.json`, with a consistency test:

| Model | Quantization | Exact bytes | Runtime status |
| --- | --- | ---: | --- |
| Dolphin 3.0 Llama 3.2 1B | Q4_K_M | 807697440 | Architecture present; weight inference pending |
| LFM3 1.7B | Q4_K_M | 1099627808 | Architecture/template source present; weight inference pending |
| Qwen3 1.7B | official Q8_0 | 1834426016 | Architecture/template source present; weight inference pending |
| Dolphin 3.0 Llama 3.2 3B | Q4_K_M | 2019382400 | Architecture present; weight inference pending |

Sources are each entry's `sourceUrl`. The remaining eight requested candidates are visible with explicit review-pending status. No guessed download URL, checksum, license or performance score enables an entry. No best-model recommendation is established by this implementation.

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

Native Hey Atlas can invoke the same engine without an active WebView, with bounded session history. Locked sessions do not include earlier unlocked conversation history or fetch vault data. Existing native command handlers run first; otherwise the background LLM provides chat, not arbitrary native tool execution. The sentence gate suppresses reasoning blocks/structured output and queues completed sentences through the existing TTS owner. Follow-up listening starts after generation and the speech queue finish. Session termination cancels its own generation. Lab voice refuses competing audio ownership rather than starting a second microphone.

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

Remaining limitations: eight candidates still need artifact/license verification; resumable downloads require manual retry; import progress/cancellation and process-restart import recovery are limited; CPU only; no Windows validation; full native/JNI behavior, voice quality, background endurance, actual model memory/temperature/battery results and signing compatibility with the installed phone build need device verification. Native background chat uses bounded session context; persistent memory selection and richer tools remain in the existing foreground assistant. Short benchmark runs cannot rank battery efficiency. Larger imports are capped at 3.5 GB for this initial phone-oriented implementation.

## Android build prerequisites

Use JDK 17, the existing Android platform/build tools 34, NDK `27.2.12479018` and CMake 3.22 or newer. Install missing SDK packages using Android Studio/SDK Manager. Then run `npm run build:mobile`, `npx cap copy android`, and `./gradlew assembleDebug testDebugUnitTest` from `android/`. The build fetches the pinned C++ source archive, never model weights. Reuse your trusted signing configuration for an installable update; this branch does not distribute a private signing key. `ATLAS_NATIVE_BUILD_DIR` optionally places generated CMake files outside the project on constrained build machines. No Vercel configuration is required.
