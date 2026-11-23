# Atlas voice activation modes (experimental Google bridge)

Source-only implementation after `141308f`. No APK, Android/Gradle build, production/mobile build, installation, push, cloud call or physical-device test was performed.

## Controls and defaults

**Control Room → Access & rules → Voice activation** offers:

- **Hey Atlas microphone listener**: selects and explicitly starts the existing wake-word service/model.
- **Google bridge · experimental**: stops Atlas's wake-word service, then observes Google/Gemini window identity changes. It does not create a standby AudioRecord, inference engine, speech recognizer or microphone foreground service.
- **Off**: stops both Atlas automatic activation methods and any current bridge voice session. The accessibility service can remain enabled in Android, but ignores events outside bridge mode; the user can disable it completely in Android settings.

The same controls appear above the existing Hey Atlas experiment. Existing installations retain their manual-start microphone configuration; the bridge is not selected/enabled automatically. Bridge Observe only defaults to true. The existing ONNX assets, wake-word parameters, private authentication policy and optional voice-provider consent remain intact. No API key or new assistant backend was added.

Native switching first persists Off, ends bridge audio/UI, stops the wake service and waits up to four seconds for Atlas audio ownership/capture/coordinator release before selecting the next method. Once Off has been saved, transition failures leave activation Off. Permission/consent rejection before switching preserves the previous mode. Legacy Start/Stop/Resume and active endurance-test starts use the same selection policy. Existing notification/service entry points cannot restart microphone capture while bridge/Off is selected. Endurance-test Start remains a microphone experiment; it is not a bridge battery benchmark.

## Google bridge setup when a test APK is available

1. Keep Google/Gemini as Android's default assistant and enable its Voice Match. These Atlas controls do not disable Google's own voice activation.
2. Open Voice activation, expand **Google bridge permission and setup**, and acknowledge its disclosure. Select Google bridge. Android may request microphone permission for subsequent commands; no idle recording starts.
3. Tap **Open Android Accessibility** and manually enable **Atlas Google voice bridge (experimental)**. A sideloaded APK may first require Android's Allow restricted settings option in App info. Atlas never enables accessibility for the user.
4. Leave Observe only enabled. Open the assistant with “Hey Google,” then return and refresh. Only the latest Google package/class identity is exposed in these diagnostics, with no screen text/transcript.
5. Confirm that the observed class is the assistant overlay, not a normal Google/Gemini screen. Tap **Enable handoff for this window**. Generic framework/material window classes are rejected. No guessed Google class ships as an approved default. Changing observation requires fresh confirmation.
6. Say “Hey Google,” pause, then speak after Atlas's ready cue. Opening the same assistant overlay manually can also trigger Atlas. Google may capture or act on words spoken before handoff; this is not command interception/cancellation through a supported Google API.
7. Use the microphone/Off controls to compare behaviour. A selected microphone mode may still be stopped if Android/model initialization prevents startup; the screen reports capture status separately and links to existing diagnostics.

## Native lifecycle

`AtlasGoogleBridgeService` receives only `TYPE_WINDOW_STATE_CHANGED`. Window-node retrieval is disabled, and it never reads node trees, event text, Google transcripts, screenshots or audio. Trigger matching is restricted to the two Google packages and the exact class confirmed by the user. Other packages/classes are compared transiently in memory only to observe a window transition after dismissal. They are not stored, logged or returned to JavaScript. There is no all-app content crawl or idle polling loop.

A fresh, approved, idle event can issue one global Back **before** any Atlas activity launch. The gate debounces for two seconds and requires a different window identity within 1.5 seconds. Input-method transitions are excluded. A metadata transition is only a best-effort observation: it is not proof that Google stopped processing audio or a command. Failure ends the attempt; it does not start a fallback microphone listener.

An unexported Activity requires a native, single-use, 15-second in-process activation token. When unlocked it forwards to `/secret/atlas`; the existing AtlasLauncher waits until voice handlers are registered before consuming the pending activation and starting the shared voice coordinator. Existing JS Atlas AI/action handling is reused. When locked, a minimal secure native screen uses the coordinator's existing restricted native fallback. The private WebView is not shown over keyguard, and keyguard is never automatically dismissed. The locked fallback has fewer capabilities; existing configured native cloud AI is used only with existing explicit consent, otherwise existing local/basic fallback behaviour applies.

Both paths share speech, TTS, stop handling and five-second follow-up behaviour. Initial recognizer-busy/audio errors can retry three times (200/400/800ms) before giving up. The initial recognizer-ready wait has a five-second cap. The ready cue occurs after the first recognizer-ready callback in bridge mode. No fixed delay is treated as a guaranteed microphone handoff. Conversations are limited to two minutes, stop when the host leaves the foreground, and never resume wake capture in bridge mode. Pending launch/session timers are cancelled on stop. Foreground voice actions may open Atlas; locked private-data restrictions remain in force.

Conversation/transcript text was removed from the touched coordinator's log statements. New diagnostics retain only process-local numeric counts, a fixed status reason and the latest Google window identity. UI listening duration is a state estimate, not verified hardware microphone-on time or energy consumption. Launch-to-session timings exclude Google's wake detection/dismissal and do not measure first speech response. Activation preferences are excluded from Android backup/device transfer; no recovery file or cloud configuration exports them.

## Validation and limits

- Full TypeScript unit suite: **536 passed**, zero failures at the validation checkpoint.
- Focused wake-word/voice suite: **19 passed**, including non-native refusal, readiness states and safe errors.
- TypeScript passed.
- Targeted ESLint: zero errors; three existing unused-value/import warnings in ControlRoom.
- `node tests/wakeword/activation-browser.mjs` passed at 390×844: modes, disclosure, explicit settings launch, exact observed-class confirmation, reconfirmation after changes, Off/error behaviour, overflow and subscription cleanup. Native/audio actions are synthetic fixtures.
- Manifest, accessibility configuration, strings and backup XML parse successfully; this does not establish Android resource compilation.
- Native JUnit/Robolectric test source covers gate freshness, cooldown, dismissal timeout, duplicate sessions, generic-class refusal and cancelling a pending activation when selecting Off. These native tests were **not compiled or executed** because Android builds remain deferred.

Device acceptance still needs the Moto Edge 50 Fusion/Android 16: actual overlay classes and emitted events, Google/Gemini versions, cold/warm launch, permission denial/revocation, app switching, microphone contention, keyguard/screen-off, calls/music, OS process death, mode switching during active speech and overnight battery comparisons. Accessibility availability, low-power Google's DSP use on this device, reliable 24/7 handoff and Google-equivalent battery/latency are not established. No Play Store approval claim is made.
