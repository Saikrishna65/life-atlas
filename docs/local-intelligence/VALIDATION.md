# Validation report — 24 November 2026

## Delivered artifact

- APK: [`atlas-2.4.0-local-ai-debug.apk`](../../work/local-intelligence/atlas-2.4.0-local-ai-debug.apk).
- App: Atlas, `com.lifeatlas.app`, version `2.4.0` / code `48`.
- Size: 59,984,709 bytes (57.2 MiB).
- APK SHA-256: `c029e2e9c8baf9749368b826175b2f85a2d31c0e3b452fce84ef1b72c581f888`.
- Signing certificate SHA-256: `f396d14bbd2076769e0edb46a3a8c4a4d4d45b57ae90a0ddd70e226e65d2d36f`.
- `apksigner verify` passed. Certificate matches the previous APK found in this workspace; the installed phone certificate has not been checked.
- Contains `libatlas_llama.so` for ARM64 and x86_64. Both new libraries have `0x4000` (16 KB) LOAD alignment. This is an ELF inspection, not a physical Android installation test.
- No GGUF weights are bundled. Four catalogue artifacts are available for explicit download; eight requested candidates remain pending review.
- Compiled against the existing SDK/target 34. Native AI is gated to API 26+. No API 36 emulator was run.

## Executed checks

| Check | Result | Evidence / scope |
|---|---|---|
| TypeScript | Passed | `npx tsc --noEmit`; production Next build also type-checked |
| Scoped ESLint | Passed | New Lab, local AI libraries/routing/personality and evaluation tests/scripts |
| Repository-wide ESLint | Existing failures | 154 errors and 189 warnings; error files are outside this change. The modified Control Room has three pre-existing unused-variable warnings. Generated `mobile-dist` is now excluded; linting its minified output previously exhausted resources. |
| Full JavaScript suite | 543 passed, 0 failed | `npm test` |
| Final targeted AI suite | 25 passed, 0 failed | `tsx --test tests/atlas-ai/*.test.ts` |
| Android JVM/Robolectric suite | 209 passed, 0 failed, 0 skipped | Existing wake-word/security/R2/gallery tests and new model-store/inference/speech tests |
| Android native build | Passed, ARM64 + x86_64 | Real C++/JNI libraries linked into the APK |
| JNI instrumentation compilation | Passed | `compileDebugAndroidTestJavaWithJavac`; execution pending device/emulator |
| Host C++ / Jinja tests | Passed | Defaults, invalid config, missing GGUF, safe cleanup, input marking and real Qwen/LFM template rendering from pinned upstream sources |
| Host CLI negative smoke | Passed | Missing-model load and generation reject, then unload completes; no substitute response |
| Mobile bundle | Passed | 199 generated assets, Lab remains a lazy route; its generated JS chunk is 41,081 bytes (14,295 bytes with gzip, excluding shared chunks) |
| Production build | Passed | Cached client/server compile 16.3 s; TypeScript 22.1 s in one recorded build. Existing Prisma-backed public content fetches logged database connectivity errors and used their established fallbacks. These are build timings, not inference measurements. |
| Browser responsive check | Passed | Offline Chromium at 390 px and 1280 px: model search, disabled unavailable operations, tabs, all 100 cases, settings, no horizontal overflow, no page errors |
| APK packaging/signing | Passed | `assembleDebug`, `apksigner verify`, package and ELF inspection |
| Git whitespace check | Passed | `git diff --check` |

Initial Android test attempts could not create a cache under the read-only home directory and then lacked offline Android test jars. The successful run used the existing repository proxy/cache test setup to obtain the official Robolectric dependencies. No test assertions were skipped to obtain the passing result.

## Not measured or not completed

- Real GGUF inference, response quality, first-token latency, throughput and sustained RAM/thermal/battery performance: **blocked here**. The managed workspace egress policy rejects Hugging Face weight downloads. A requested policy update did not complete. Metadata could be reviewed through the research tool; weight files were not obtained. No quality scores or device performance numbers were invented.
- Physical Moto testing: **pending**; phone is unavailable.
- Android 16/API 36 emulator execution: **not performed**; no configured emulator, no `/dev/kvm`, and insufficient remaining disk for an emulator image.
- Native Windows execution: **not performed**; this machine is Linux. A portable CMake CLI and standard-library Python runner are provided.
- Eight candidate models: exact artifact/license compatibility review remains pending. Catalogue verification of the other four does not mean that model inference has passed on this phone.
- Vulkan/OpenCL/Qualcomm NPU: **not compiled or tested**. Unsupported GPU controls reject explicitly.
- Import progress/cancellation, automatic connectivity retry, richer background native tools, and complete device-side performance rankings remain limited. Existing foreground tools retain their production validation/confirmation path.
- `firstSentenceMs` is a punctuation-boundary estimate, not measured first audio playback. TTS, lock-screen handoff, background endurance and microphone coexistence need device verification.

## Visual evidence

These are actual browser captures of the implemented Lab, in its honest native-unavailable state. They are not Android screenshots or mock inference results.

- [Mobile preview](previews/lab-mobile.png)
- [Desktop preview](previews/lab-desktop.png)

See [phone test instructions](DEVICE-TESTS.md), [architecture and limitations](README.md), and [changed files](FILES.md).
