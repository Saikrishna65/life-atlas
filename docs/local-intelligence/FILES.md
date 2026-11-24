# Changed files

Compared with implementation baseline `3015c56`. Build outputs, downloaded dependencies, model weights and local tooling are not committed. `A` = added, `M` = modified.

| Status | File |
|---|---|
| M | `android/app/build.gradle` |
| M | `android/app/proguard-rules.pro` |
| A | `android/app/src/androidTest/java/com/lifeatlas/app/ai/AtlasJniTest.java` |
| M | `android/app/src/main/AndroidManifest.xml` |
| M | `android/app/src/main/assets/atlas-model-catalogue.json` |
| A | `android/app/src/main/assets/licenses/ggml-MIT.txt` |
| A | `android/app/src/main/assets/licenses/llama-cpp-MIT.txt` |
| A | `android/app/src/main/assets/licenses/nlohmann-MIT.txt` |
| A | `android/app/src/main/cpp/local-ai/CMakeLists.txt` |
| A | `android/app/src/main/cpp/local-ai/atlas_cli.cpp` |
| A | `android/app/src/main/cpp/local-ai/atlas_core_test.cpp` |
| A | `android/app/src/main/cpp/local-ai/atlas_engine.cpp` |
| A | `android/app/src/main/cpp/local-ai/atlas_engine.h` |
| A | `android/app/src/main/cpp/local-ai/atlas_jni.cpp` |
| A | `android/app/src/main/cpp/local-ai/atlas_template.cpp` |
| A | `android/app/src/main/cpp/local-ai/atlas_template.h` |
| M | `android/app/src/main/java/com/lifeatlas/app/AtlasLocalAIPlugin.java` |
| M | `android/app/src/main/java/com/lifeatlas/app/AtlasModelsPlugin.java` |
| A | `android/app/src/main/java/com/lifeatlas/app/ai/AtlasDownloadRules.java` |
| A | `android/app/src/main/java/com/lifeatlas/app/ai/AtlasInferenceRuntime.java` |
| A | `android/app/src/main/java/com/lifeatlas/app/ai/AtlasLabHistory.java` |
| A | `android/app/src/main/java/com/lifeatlas/app/ai/AtlasLlamaNative.java` |
| A | `android/app/src/main/java/com/lifeatlas/app/ai/AtlasModelDownloadService.java` |
| A | `android/app/src/main/java/com/lifeatlas/app/ai/AtlasModelStore.java` |
| A | `android/app/src/main/java/com/lifeatlas/app/ai/AtlasSpeechGate.java` |
| M | `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasVoiceCoordinator.kt` |
| A | `android/app/src/test/java/com/lifeatlas/app/ai/AtlasInferenceTest.java` |
| A | `android/app/src/test/java/com/lifeatlas/app/ai/AtlasModelStoreTest.java` |
| A | `docs/local-intelligence/DEVICE-TESTS.md` |
| A | `docs/local-intelligence/FILES.md` |
| A | `docs/local-intelligence/README.md` |
| A | `docs/local-intelligence/VALIDATION.md` |
| A | `docs/local-intelligence/previews/lab-desktop.png` |
| A | `docs/local-intelligence/previews/lab-mobile.png` |
| M | `eslint.config.mjs` |
| M | `mobile/App.tsx` |
| A | `scripts/local-ai/bench-desktop.py` |
| A | `scripts/local-ai/export-cases.ts` |
| A | `src/app/secret/control-room/intelligence/page.tsx` |
| M | `src/components/control-room/ControlRoom.tsx` |
| A | `src/components/intelligence-lab/IntelligenceLab.tsx` |
| A | `src/components/intelligence-lab/intelligence-lab.css` |
| M | `src/lib/atlas-ai/conversation.ts` |
| A | `src/lib/atlas-ai/lab/benchmark.ts` |
| A | `src/lib/atlas-ai/lab/cases.ts` |
| A | `src/lib/atlas-ai/lab/catalogue.ts` |
| A | `src/lib/atlas-ai/lab/client.ts` |
| A | `src/lib/atlas-ai/lab/config.ts` |
| A | `src/lib/atlas-ai/lab/envelope.ts` |
| A | `src/lib/atlas-ai/lab/verified-models.json` |
| M | `src/lib/atlas-ai/model-catalogue.ts` |
| M | `src/lib/atlas-ai/native.ts` |
| M | `src/lib/atlas-ai/personality.ts` |
| M | `src/lib/atlas-ai/providers.ts` |
| M | `tests/atlas-ai/context.test.ts` |
| A | `tests/atlas-ai/lab-browser.mjs` |
| A | `tests/atlas-ai/lab.test.ts` |
| M | `tests/atlas-ai/native-contract.test.ts` |

## Completion pass (after b616c33)

- Added `AtlasVoiceLatencyTrace.java` and its native JVM test: bounded content-free stage timing.
- Added `AtlasModelTransferTest.java`: production transfer state-machine recovery/cancel/storage tests.
- Added optional real-weight `AtlasRealModelTest.java`: actual JNI assertions, compiled but not executed here.
- Added `scripts/local-ai/verify-model.py` and `smoke-native.py`: supplied-file integrity and real native smoke runner.
- Added `MODELS.md` and `WINDOWS-TESTS.md`: all twelve candidates, exact downloadable artifacts, block reasons and reproducible local commands.
- Updated model store/plugin/foreground transfer service, inference runtime, native engine/JNI, voice coordinator, local AI bridge, catalogue mirrors, Lab import status, CSV/benchmark initialization, session privacy and action lock checks.
- Updated existing voice diagnostics UI/types and scoped regression/browser tests.
- Updated Android version to 2.4.1 / 49. No model weights, credentials, build tooling or APK binary is committed.
