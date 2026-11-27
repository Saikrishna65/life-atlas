# Atlas — Hey Atlas Phase 3 Handoff Context

> **Last Updated:** 2026-11-18
> **Git Branch:** `experiment/hey-atlas-phase3` (branched from `experiment/hey-atlas-wakeword` @ `6bd6561`)
> **Target Device:** Motorola Edge 50 Fusion · Android 16 (SDK 36)
> **Purpose:** Self-contained cross-machine handoff context so you (or Antigravity) can clone/pull this branch on a new computer, understand every Phase 3 module, test via voice or text, and continue immediately.

---

## 1. Non-Negotiable Constraints & Ground Rules

1. **Branch Isolation**: Do **not** merge into `main` or `private-app-ai`, and do **not** push or deploy without explicit user permission.
2. **Next.js Workspace Rule (`AGENTS.md`)**: Always read relevant guides in `node_modules/next/dist/docs/` before editing Next.js code.
3. **Preserve Working Phase 1 & Phase 2 Subsystems**:
   - Keep `hey_atlas.onnx` threshold `0.90f`, 2-hit confirmation, `3000 ms` cooldown, `OvernightTestManager`, `AtlasAudioOwnershipCoordinator`, and zero raw audio capture.
4. **Security & Privacy Guarantees**:
   - Cloud AI API keys are **never** stored in `localStorage` or plaintext `SharedPreferences`. All secrets live in `AtlasVoiceSecureStore` (Android Keystore AES-256-GCM + `AtomicFile` in `noBackupFilesDir/wakeword/voice_secure_state.bin`).
   - Lock-screen queries (`isLocked == true`) must **never** expose Finance, Memories, Trips, or private Vault data.
   - Destructive/sensitive mutations require explicit confirmation.

---

## 2. Phase 3 Implemented Architecture & File Map

### A. Native Android Security, Latency & Bridge
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasVoiceSecureStore.kt`
  - Android Keystore AES-256-GCM encrypted storage for `cloudConsent`, `cloudProvider`, `cloudApiKey` (native-only read), encrypted companion memories (capped at 60), and personality traits.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasVoiceCoordinator.kt`
  - Uses `AtlasVoiceSecureStore` (auto-migrating & deleting any legacy `SharedPreferences` keys).
  - Measures monotonic `SystemClock.elapsedRealtime()` latency across 6 stages (`wakeToGreetingMs`, `greetingToListenMs`, `speechEndToTranscriptMs`, `transcriptToAiResponseMs`, `aiResponseToFirstAudioMs`, `sessionEndToWakeMs`) and emits `voiceLatencyMetrics`.
  - Adds `interruptSpeaking()` for tap-to-interrupt while TTS is speaking, and `callSecureCloudAiSync(...)` for native HTTPS Gemini/OpenAI requests.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/voice/AtlasVoiceSpeechManager.kt`
  - Added `onEndOfSpeech()` listener callback for accurate STT end-to-transcript timing.
- `android/app/src/main/kotlin/com/lifeatlas/app/wakeword/AtlasWakeWordPlugin.kt` & `src/lib/wakeword/atlasWakeWord.ts`
  - Exposes `saveVoiceCloudConfig`, `getVoiceCloudStatus`, `clearVoiceCloudKey`, `getEncryptedMemories`, `saveEncryptedMemories`, `getVoicePersonality`, `saveVoicePersonality`, `callSecureCloudAi`, `interruptVoiceSpeaking`, and `getVoiceLatencyMetrics`.

### B. Unified TypeScript Intelligence, Policy, Personality & Memory
- `src/lib/atlas-ai/policy.ts`: `ATLAS_POLICY_VERSION = "atlas-policy-v1"`, `LOCK_SCREEN_SAFE_ACTION_IDS`, `CONFIRMATION_REQUIRED_ACTION_IDS`, `containsSensitiveVaultQuery`, `isSeriousSituation`, `evaluateActionPolicy`.
- `src/lib/atlas-ai/personality.ts`: 9-trait Personality Engine (`humor`, `playfulness`, `sweetness`, `directness`, `energy`, `formality`, `teasing`, `proactivity`, `responseLength`) separated from safety policies, suppressing humor on serious/safety topics.
- `src/lib/atlas-ai/memory.ts`: Bounded 14-turn session memory + rolling `sessionSummary`, plus explicit-approval Keystore persistent memory rejecting passwords, PINs, OTPs, and API keys.
- `src/lib/atlas-ai/providers.ts`: Hybrid AI router (local LLM runtime check -> consented native Keystore Cloud AI -> honest `null` fallback; never fabricates answers).
- `src/lib/atlas-ai/conversation.ts` & `src/lib/atlas-ai/voice-assistant.ts`: Multi-turn slot-filling (weekend trip planning, budget updates/corrections, reminders), ambiguity clarification, ordinal/pronoun resolution (`"the first one"`, `"Show the second day"` -> `"Actually, the third day"`, `"Add a reminder for that"`), session summary, and explicit end commands.

### C. Typed Action Registry, Multi-Step Planner & Sample Test Seeder
- `src/lib/atlas-ai/gateway.ts`, `src/lib/atlas-ai/local-adapters.ts`, `src/lib/atlas-ai/action-registry.ts`: Typed Action Registry covering Atlas Music, Atlas Trips, Atlas Finance, Reminders, Control Room, and Navigation with permissions, lock-screen flags, confirmation gates, bounded audit log, and undo hooks.
- `src/lib/atlas-ai/planner.ts` & `src/lib/atlas-ai/reminders.ts`: Multi-step `TaskPlan` executor (`executeOpenTripAndPackReminderWorkflow` resolving `"the night before"` against `trip.startDate`, syncing to Atlas Trips `saveReminder` + `scheduleNativeNotification`, verifying, and rolling back on failure).
- `src/lib/atlas-ai/demo-seed.ts`: `seedAtlasDemoData()` / `clearAtlasDemoData()` creating reversible `demo-*` Trips, Music WAV tracks/playlist, Finance Wallet + transactions, and Reminders.

### D. Frontend UI
- `src/components/secret/AtlasLauncher.tsx` & `atlas-launcher.module.css`: Floating orb & active voice pill with inline `Confirm` / `Cancel` action prompts and `Interrupt` button during TTS speaking.
- `src/components/control-room/HeyAtlasExperiment.tsx`: Keystore Cloud AI Save/Clear Key controls + **Load Sample Test Data** / **Clear Sample Data** buttons.
- `src/app/secret/atlas/page.tsx`: 9-trait Companion Personality Studio sliders, Keystore Companion Memories CRUD, `control.read` permission toggle, and Voice Pipeline Latency Telemetry display.

---

## 3. How to Test (Text & Voice)

### Option A: Quick Sample Data on Device
1. Open **Control Room → Hey Atlas** in the app.
2. Tap **Load Sample Test Data** (seeds 2 trips with itinerary days, 2 offline playable WAV tracks + playlist, Finance Wallet + 2 expenses, and 2 reminders).
3. Tap **Clear Sample Data** when finished.

### Option B: Testing by Voice (Hands-Free or Push-to-Talk)
- Turn on listening in **Control Room → Hey Atlas** and say **"Hey Atlas"** (or tap **Start Hands-Free Voice** in `/secret/atlas`).
- Try:
  - *"I'm thinking about going somewhere this weekend"* → *"Somewhere peaceful, not too expensive"* → *"Around three thousand"* → *"Yes, and remind me to pack the day before"*
  - *"Open my upcoming trip and remind me to pack the night before"*
  - *"Open my trip"* → *"the first one"* → *"Show the second day"* → *"Actually, the third day"* → *"Add a reminder for that"*
  - *"Play Mountain Breeze"* → *"Pause"* → *"What's playing?"*
  - *"What is my finance balance?"* (also test while phone is locked to confirm lock-screen privacy guard)

### Option C: Testing by Text (Without Speaking)
- **Automated multi-turn simulation**: Run `npx tsx --test tests/atlas-voice-assistant.test.ts` (12 tests covering text-driven `processVoiceTurn(...)` multi-turn conversations, corrections, planner rollback, lock-screen guard, memory, and hybrid routing).
- **Interactive UI**: Open `/secret/atlas` (unlocked) to type in the conversation box (when a local LLM or Cloud AI is active) or add/complete/delete **Voice Reminders** and **Keystore Companion Memories** directly.

---

## 4. Standard Commands to Resume on a New Computer

### Clone / Pull & Install
```powershell
git clone <your-repo-url> "life atlas"
cd "life atlas"
git checkout experiment/hey-atlas-phase3
git pull origin experiment/hey-atlas-phase3
npm install
```

### Verify TypeScript, Tests & Mobile Bundle
```powershell
npx tsc --noEmit
npx tsx --test tests/atlas-voice-assistant.test.ts
npm run build:mobile
npx cap copy android
```

### Build Android Unit Tests & Debug APK
```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\android\gradlew.bat -p android testDebugUnitTest assembleDebug
```
APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Install & Debug on Device (USB or Wireless ADB)
```powershell
adb connect <PHONE_IP>:<PORT>
adb -s <PHONE_IP>:<PORT> install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s <PHONE_IP>:<PORT> shell am start -n com.lifeatlas.app/.MainActivity
adb -s <PHONE_IP>:<PORT> logcat -d -s AtlasWakeWordService:V AtlasVoiceCoordinator:V AtlasVoiceSpeech:V AtlasVoiceTTS:V AtlasAudioOwnership:V
```

---

## 5. Verification Status (As of 2026-11-18)

- **Verified Passing**:
  - `npx tsc --noEmit` (0 errors)
  - `npx tsx --test tests/atlas-voice-assistant.test.ts` (12/12 passing)
  - `npm test` (391/392 passing; 1 pre-existing unrelated failure in `tests/public/heroPreservation.test.ts`)
  - `npm run build:mobile` (134 assets) & `npx cap copy android`
  - `.\android\gradlew.bat -p android testDebugUnitTest assembleDebug` (`BUILD SUCCESSFUL`, includes `AtlasVoicePolicyTest.kt`)
  - APK installed & launched on Motorola Edge 50 Fusion (`192.168.1.10:41867`, `Success`)
- **Pending Live Device Verification**:
  - Live spoken multi-turn tests after tapping **Load Sample Test Data**
  - Capturing real monotonic latency numbers in `/secret/atlas` **Voice Pipeline Latency Telemetry**
  - Optional live Gemini/OpenAI Keystore call test on device
