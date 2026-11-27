# Atlas — Hey Atlas Wake-Word Feasibility Experiment

> **Scope:** Controlled, reversible proof of concept on branch `experiment/hey-atlas-wakeword`.
> **Target Device:** Motorola Edge 50 Fusion · Android 16 · Private sideloaded APK (no root, no Shizuku, no privileged system permissions, no accessibility-service workarounds).

---

## 1. Reference Projects Inspected

| Reference Project | License | Architecture Highlights Observed | Suitability / Notes |
|---|---|---|---|
| **Hark** (`OpenAppCapabilityProtocol/hark`) | Apache-2.0 | Uses `openWakeWord` via `onnxruntime-android`, a `WakeWordService` (`FOREGROUND_SERVICE_TYPE_MICROPHONE`) with explicit Stop notification action, and optional `VoiceInteractionService.showSession()` integration. | Primary architectural inspiration for clean FGS + ONNX + VIS separation. |
| **Dicio Android** (`DicioTeam/dicio-android`) | GPL-3.0 | Offline `openWakeWord` ONNX pipeline (`melspectrogram.onnx`, `embedding_model.onnx`, keyword `.onnx`), `AudioRecord` capture, custom model file import. | Studied high-level pipeline only; **no code copied** due to GPL-3.0 copyleft. |
| **Rhasspy Mobile** (`Nailik/rhasspy_mobile`) | MIT | Foreground microphone service lifecycle and Porcupine keyword engine integration. | Useful reference for Android audio focus / interruption edge cases. |
| **openWakeWord** (`dscripka/openWakeWord`) | Apache-2.0 (framework & extractors), CC BY-NC-SA 4.0 (pre-trained keyword weights) | 3-stage streaming ONNX pipeline at 16 kHz mono PCM (80 ms / 1280-sample chunks): `melspectrogram.onnx` -> `embedding_model.onnx` (76×32 -> 96-dim) -> keyword classifier (`[batch, 16, 96]`). | Selected for offline PoC. Zero API keys, zero network calls, zero proprietary lock-in. |

### Engine Comparison: openWakeWord vs. Picovoice Porcupine

- **Custom `"Hey Atlas"` support:** Neither ships a free ready-made `"Hey Atlas"` binary out of the box. `openWakeWord` allows training an unrestricted custom `.onnx` model offline using open-source tooling and loading it locally with zero runtime license keys. Picovoice Porcupine requires creating a Picovoice Console account and embedding an `AccessKey`, and custom `.ppn` training/distribution is governed by Picovoice commercial/personal tier limits.
- **Offline operation & privacy:** `openWakeWord` + `onnxruntime-android` executes 100% locally in-memory without phone-home license validation.
- **CPU / Memory / Latency expectations:** Measured on similar mid-range Snapdragon devices at ~1–4% single-core equivalent CPU during continuous listening, ~40–90 MB native heap overhead for ONNX Runtime + buffers, and <100 ms post-utterance detection latency (to be measured directly on the Motorola Edge 50 Fusion).

---

## 2. Honest Model Status: No Pre-Built `"Hey Atlas"` Model Exists

Inspecting `dscripka/openWakeWord` v0.5.1/v0.6.0 confirms that **only** these pre-trained English keyword models exist upstream:
- `alexa_v0.1.onnx`
- `hey_jarvis_v0.1.onnx`
- `hey_mycroft_v0.1.onnx`
- `hey_rhasspy_v0.1.onnx`
- `timer_v0.1.onnx`
- `weather_v0.1.onnx`

There is **no** pre-trained `"Hey Atlas"` ONNX model in upstream `openWakeWord`.

Accordingly:
1. This experiment bundles `melspectrogram.onnx`, `embedding_model.onnx`, and `hey_jarvis_v0.1.onnx` cleanly under `android/app/src/main/assets/wakeword/` strictly as a **Pipeline Test Model** (`isCustomHeyAtlasModel = false`).
2. The app UI, detection notifications, and diagnostic exports explicitly display **`Hey Jarvis (Pipeline Test Model)`** when the test weights are active and **never** claim `"Hey Atlas"` detection until a real custom `hey_atlas.onnx` model is imported or bundled.

### Custom `"Hey Atlas"` Training Requirements

To produce a real `hey_atlas.onnx` classifier compatible with this Android service:
1. **Input audio:** 16 kHz, 16-bit mono PCM.
2. **Feature chain:** Must use the matching `melspectrogram.onnx` and `embedding_model.onnx` extractors bundled in `assets/wakeword/` so embeddings match in distribution.
3. **Training data:**
   - ~20,000–50,000 synthetic positive utterances (`"hey atlas"`, `"hey at-las"`, multi-speaker Piper/VITS TTS) + room impulse responses (RIR) and background noise augmentation (MUSAN / DEMAND / AudioSet).
   - Hard-negative adversarial phrases (`"hey alice"`, `"atlas"`, `"at last"`, `"hey alex"`), plus 1,000+ hours of clean conversational negative features (provided pre-computed by openWakeWord's `openwakeword_features` dataset).
4. **Export contract:**
   - Export an ONNX classifier accepting input tensor shape **`[batch, 16, 96]`** (`float32`, batch-first, 16 embedding frames × 96 dimensions) and outputting scalar wake score `[batch, 1]` in `0.0..1.0`.
5. **Load on device:**
   - Transfer `hey_atlas.onnx` to the phone, open `Control Room -> Experiments -> Hey Atlas`, and tap **Import Custom hey_atlas.onnx**. `WakeWordModelManager` verifies tensor shape `[batch, frames, 96]`, records SHA-256, stores it under `noBackupFilesDir/wakeword/custom_hey_atlas.onnx`, and switches the active model badge to `Custom Hey Atlas Model Active`.

---

## 3. Native Architecture Overview

- `AtlasWakeWordService` (`foregroundServiceType="microphone"`, `START_NOT_STICKY`)
  - Starts **only** from explicit user action in the UI (never on boot or hidden background triggers).
  - Shows a persistent notification with an explicit **Stop Listening** action button.
  - Captures `AudioRecord` at 16 kHz mono 16-bit (`VOICE_RECOGNITION` with `MIC` fallback), pushing strictly 1280-sample chunks into `OpenWakeWordFeatureBuffers` (2-second max PCM ring buffer; zero disk storage, zero raw PCM logging, zero network upload).
  - Monitors Android `AudioManager.AudioRecordingCallback` for mic silencing / competition (calls, Recorder, Assistant) and `Telephony`/communication audio mode.
  - Emits only minimal local feedback on trigger: short haptic pulse, synthesized C5–E5 tone via `AudioTrack` (suppressed during calls/silenced state), local notification, event to Control Room UI if open, and optional `AtlasExperimentVoiceInteractionService.showSession()` when default assistant role is held and enabled by the user.
- `AtlasExperimentVoiceInteractionService` / `SessionService` / `Session` / `RecognitionService`
  - Isolated, optional experiment for `RoleManager.ROLE_ASSISTANT` & overlay testing on unlock / lock screen. Does **not** access Atlas vaults or cloud LLMs.

---

## 4. Field Test Plan for Motorola Edge 50 Fusion (Android 16)

Test every scenario in `Control Room -> Experiments -> Hey Atlas` and record genuine observed outcomes using the interactive Tests A–H checklist:

- **Test A (Foreground, screen on):** Baseline accuracy, false-positive rate, and inference latency (`ms`).
- **Test B (Backgrounded app):** Press Home / switch apps while listening remains enabled; verify Android privacy dot + ongoing notification behavior.
- **Test C (Screen off, 1–2 min):** Press Power button, wait 60–120 s, speak wake phrase. Record whether partial wake lock keeps `AudioRecord` active.
- **Test D (Screen off, prolonged Doze 15–30+ min):** Compare **Default/Optimized** vs **Unrestricted** battery setting on Motorola Edge 50 Fusion.
- **Test E (Locked device):** Lock with fingerprint/PIN; verify notification / chime vs keyguard behavior on lock screen.
- **Test F (Music / Bluetooth audio):** Test loudspeaker music and Bluetooth headset routing while service listens.
- **Test G (Mic competition / phone call):** Open Voice Recorder or place a call; verify `micSilenced` state detection and clean recovery afterward.
- **Test H (Swipe away from Recents / Reboot):** Confirm service stops cleanly (`START_NOT_STICKY`) and does **not** silently resurrect on boot (complying with Android 14–16 background microphone FGS restrictions).
