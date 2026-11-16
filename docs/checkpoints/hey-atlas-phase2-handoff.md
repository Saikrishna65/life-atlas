# Life Atlas — Hey Atlas Wake-Word & Voice Assistant Handoff Context

> **Last Updated:** 2026-11-16
> **Git Branch:** `experiment/hey-atlas-wakeword` (Head commit prior to this file: `ddc599b`)
> **Target Device:** Motorola Edge 50 Fusion · Android 16 (SDK 36)
> **Purpose:** Self-contained context file so Antigravity (or any developer) on another machine can `git pull`, understand the full architecture, constraints, and empirical device findings, and resume work immediately.

---

## 1. Non-Negotiable Constraints & Ground Rules

1. **Branch Isolation**: All work lives on `experiment/hey-atlas-wakeword`. Do **not** merge into `main` or `private-app-ai`, and do not push or deploy production builds without explicit user permission.
2. **Next.js Workspace Rule (`AGENTS.md`)**: Always read relevant guides in `node_modules/next/dist/docs/` before editing Next.js code.
3. **Preserve Working Subsystems**:
   - Do **not** break the working `hey_atlas.onnx` 3-stage ONNX Runtime pipeline, 2-consecutive-hit detection, `3000 ms` cooldown, `buffers.reset()`, AudioFocus pre-emption, `25 s` mic-competition recovery, or active phone-call handling.
   - Do **not** break the **Overnight Endurance Test** (`OvernightTestManager`) or Baseline Standby test.
   - **Zero Raw Audio**: Never write raw microphone PCM to disk, logs, or network.
4. **Honest AI & Privacy Guarantees**:
   - There is currently **no** bundled local LLM GGUF runtime in this APK (`AtlasLocalAIPlugin.runtimeStatus()` returns `available: false, engine: "none"`). Never fabricate LLM outputs.
   - Lock-screen queries must **never** expose Finance, Memories, Trips, or private Vault data while `KeyguardManager.isKeyguardLocked` is true.
   - Sensitive mutations (`delete`, `finance.expense`, `finance.categorize`, `trips.editTitle`, cloud share/publish, security changes) must require explicit UI confirmation when unlocked.

---

## 2. Implemented Features & File Map

### A. Offline Wake-Word Service & Mic Coexistence (Phase 1)
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/AtlasWakeWordService.kt`
  - `foregroundServiceType="microphone"`, `START_NOT_STICKY`.
  - Uses `MediaRecorder.AudioSource.VOICE_RECOGNITION` (fallback `MIC`) with `20 ms` (`320`-sample) reads for fast `<20 ms` hardware release on external competition.
  - Exposes `@Volatile var isMicActuallyCapturing`, `isServiceRunning`, `isServicePaused`, `isMicSilenced`, `voiceAssistantEnabled`, and `activeVoiceCoordinator`.
  - Guards `onRecordingConfigChanged` and `audioFocusChangeListener` with `!pausedForVoiceSession.get()` so Atlas's own `SpeechRecognizer` does not trigger false mic-competition pre-emption.
  - Applies a `400 ms` `ignoreAudioUntilElapsedMs` window when resuming from a voice session so TTS tail cannot re-trigger the model.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/OpenWakeWordEngine.kt` & `OpenWakeWordFeatureBuffers.kt`
  - Offline ONNX pipeline: `melspectrogram.onnx` -> `embedding_model.onnx` -> `hey_atlas.onnx`.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/WakeWordModelManager.kt`
  - Bundles `wakeword/hey_atlas.onnx` (`threshold = 0.90f`, `cooldownMs = 3000L`, `requiredConsecutiveHits = 2`).
  - *Empirical note*: Threshold was raised from `0.65f` to `0.90f` after Motorola Edge 50 Fusion `diagnostics.json` captures showed ambient chatter false activations at `0.727` and `0.881` while real `"Hey Atlas"` utterances scored `0.998–1.000`.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/WakeWordDiagnostics.kt`
  - Persists telemetry and `diagnostics.json` to `noBackupFilesDir/wakeword/`.

### B. Overnight Endurance Test & Baseline Comparison
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/OvernightTestManager.kt`
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/OvernightSnapshotReceiver.kt`
- `android/app/src/test/java/com/lifeatlas/app/wakeword/OvernightTestManagerTest.kt`
  - Tracks start/end battery %, charging state, screen/lock state, `serviceRunningDurationMs` vs `confirmedActiveListeningDurationMs` (via `onAudioTick` piggybacked on the capture loop's 1-second stats flush — no extra CPU wakes), detections (no raw audio), interruptions, and monitoring gaps (`> 25 min`).
  - Supports **Active Test** and **Baseline Test (Listening Disabled)** using inexact `AlarmManager.ELAPSED_REALTIME` (`OvernightSnapshotReceiver`).
  - Persists to `noBackupFilesDir/wakeword/overnight_test.json` and exports Morning Report JSON & CSV.

### C. Phase 2: Native Voice-Session Coordinator & Audio Ownership
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasAudioOwnershipCoordinator.kt`
  - Single-owner state machine (`NONE`, `WAKE_WORD`, `SPEECH_RECOGNIZER`, `TTS`, `EXTERNAL_APP`) with deterministic `awaitRelease(...)` callbacks and unit tests (`AtlasAudioOwnershipCoordinatorTest.kt`).
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasVoiceCoordinator.kt`
  - 11 deterministic states: `IDLE`, `WAKE_LISTENING`, `WAKE_DETECTED`, `SESSION_STARTING`, `COMMAND_LISTENING`, `TRANSCRIBING`, `THINKING`, `SPEAKING`, `FOLLOW_UP_LISTENING`, `SESSION_ENDING`, `ERROR_RECOVERY`.
  - Prevents duplicate sessions (`isSessionActive()`).
  - Pre-warms TTS on service startup (`ttsManager.warmUp()`), speaks `"Hey! What's up?"` on wake when `greetOnWake = true`, runs STT, checks `AtlasWakeWordPlugin.isAppForeground()`:
    - **App in foreground**: Emits `voiceCommand` to WebView JS (`processVoiceTurn`).
    - **App backgrounded / locked**: Runs native handler immediately (lock-screen privacy guard, Android system media keys, native pending reminders saved to `atlas_voice_prefs`, `MainActivity` route launches via `SYSTEM_ALERT_WINDOW` or notification fallback, and optional consented Cloud AI over HTTPS).
  - Ends sessions silently on `COMMAND_LISTENING` no-match/timeout so accidental triggers don't interrupt conversations, and closes cleanly (`endSession = true`) on navigation commands.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasVoiceSpeechManager.kt`
  - Prefers Android 12+ `SpeechRecognizer.createOnDeviceSpeechRecognizer` (`en-IN` preference, `EXTRA_PARTIAL_RESULTS = true`, `650 ms` complete silence / `500 ms` possibly complete, `AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE`). Online fallback disabled by default.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasVoiceTtsManager.kt`
  - Selects best offline English voice (`en-IN` / `en-GB` / `en-US`, prioritizing female/high-quality offline voices), `USAGE_ASSISTANT`, `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`, `pitch = 1.04f`, `speechRate = 1.10f`.

### D. Android Bridge, Permissions & Activity Routing
- `android/app/src/main/AndroidManifest.xml`: Declares `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `AtlasWakeWordService`, `OvernightSnapshotReceiver`, and `AtlasExperimentVoiceInteractionService`.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/AtlasWakeWordPlugin.kt`: Tracks `appInForeground`, exposes overnight & voice-session methods, syncs Cloud AI prefs (`atlas_voice_prefs`), opens overlay permission settings (`openOverlayPermissionSettings`).
- `android/app/src/main/java/com/lifeatlas/app/MainActivity.java`: Handles `target_route` (`/secret`, `/secret/atlas`, `/secret/music`, `/secret/vault`, `/secret/finance`).

### E. Frontend AI Router, Actions, Reminders & Orb UI
- `src/lib/wakeword/atlasWakeWord.ts`: Typed Capacitor bridge for wake-word, overnight test, and voice-session APIs.
- `src/lib/atlas-ai/reminders.ts`: Local reminder storage (`life_atlas_voice_reminders_v1`).
- `src/lib/atlas-ai/gateway.ts` & `src/lib/atlas-ai/local-adapters.ts`: Typed `AtlasAction`s including `reminder.create` and `reminder.list`.
- `src/lib/atlas-ai/voice-assistant.ts`: Multi-turn session context (`activeTripId`, `lastTripDay`), lock-screen guard, sensitive-mutation guard, typed action execution, local LLM check, optional consented Cloud AI (`Gemini` / `OpenAI` BYOK or `appServiceUrl('/api/atlas/chat')`), and transparent `"I heard \"...\""` offline fallback.
- `src/components/secret/AtlasLauncher.tsx` & `atlas-launcher.module.css`: Global `/secret/*` voice command listener, native reminder sync, orb state animations, and compact active-session pill (`Stop`, `Open Atlas`).
- `src/components/control-room/HeyAtlasExperiment.tsx`: Experiment dashboard containing Wake-Word controls, **Voice Session Coordinator** (state, overlay permission button, wake greeting toggle, online STT & Cloud AI consent/key config), **Overnight Endurance Test** + Morning Report + JSON/CSV export, and Tests A–H matrix.
- `tests/atlas-voice-assistant.test.ts`: Node test suite verifying lock-screen guard, stop commands, sensitive mutation guard, and offline fallback.

---

## 3. Standard Commands to Resume Work on Another Machine

### Pull & Setup
```powershell
git fetch origin
git checkout experiment/hey-atlas-wakeword
git pull origin experiment/hey-atlas-wakeword
npm install
```

### Verify TypeScript, JS Tests & Mobile Bundle
```powershell
npx tsc --noEmit
npx tsx --test tests/atlas-voice-assistant.test.ts
npm run build:mobile
npx cap copy android
```
> Note: On Windows PowerShell, `npm run build:mobile` builds the offline static bundle into `mobile-dist/` and `npx cap copy android` copies it to `android/app/src/main/assets/public/`.

### Build & Test Android APK
Use Android Studio's JBR as `JAVA_HOME`:
```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\android\gradlew.bat -p android testDebugUnitTest assembleDebug
```
APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Install & Debug on Connected Motorola Edge 50 Fusion
```powershell
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.lifeatlas.app/.MainActivity
adb logcat -d -s AtlasWakeWordService:V AtlasVoiceCoordinator:V AtlasVoiceSpeech:V AtlasVoiceTTS:V AtlasAudioOwnership:V
```

---

## 4. Current Status & Suggested Next Tasks

- **Completed & Verified in CI/Local Build + Unit Tests**: All TypeScript checks, JS tests (4/4), Android unit tests (`OvernightTestManagerTest`, `AtlasAudioOwnershipCoordinatorTest`, existing suite), mobile bundle sync, and `assembleDebug` pass as of commit `ddc599b`.
- **On-Device Verification Pending / Recommended Next Steps**:
  1. Verify on the Motorola Edge 50 Fusion that the raised `0.90f` threshold eliminates false ambient triggers while keeping genuine `"Hey Atlas"` triggers reliable.
  2. Verify snappy foreground navigation from the Home screen once **Allow Display Over Other Apps** is granted in **Control Room → Hey Atlas Wake-Word**.
  3. Test an ~8-hour locked **Overnight Endurance Test** and a separate **Baseline Test** and export the Morning Report CSV/JSON.
  4. Optional future upgrades:
     - Bundle an on-device GGUF runtime (or wire a deployed `/api/atlas/chat` backend route) so open-ended offline/cloud chat works without a personal BYOK key.
     - Test lock-screen `SpeechRecognizer` restrictions across longer idle/Doze periods on Android 16.
