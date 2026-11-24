# Phone verification: Moto Edge 50 Fusion, 8 GB physical RAM, Android 16

No installation or device tests were performed while the phone was unavailable. Start with the smallest model. Do not interpret desktop timings or browser screenshots as phone performance.

## Install and open

1. Use the APK linked in `VALIDATION.md`. It contains Atlas and the existing Gallery launcher, not a separate AI test app. It contains no GGUF weights.
2. If using adb, run `adb install -r atlas-2.4.1-local-ai-debug.apk`. Otherwise open the APK on the phone and approve Android's installer prompt. The certificate must match the installed build for an in-place update. If Android rejects the signature, use the original trusted signing key; do not uninstall the app merely to bypass a mismatch with valuable local data.
3. Open **Control Room → Intelligence Lab**. Check that the runtime is unloaded and no download has started by itself.
4. On Wi-Fi choose **Dolphin 3.0 · 1B → Download**, read/accept its model license, wait for checksum verification, then **Use model**. The artifact is 807,697,440 bytes. Keep additional storage and RAM available; this is not a measured memory footprint.
5. Alternatively choose **Import GGUF** for a model you trust. Import streams to app-private storage, calculates SHA-256 and preserves the original file. Unknown architectures/templates may fail safely at load time.

## Functional checks

- Playground: ask a greeting, a short planning question, a correction and a follow-up. Verify streamed output and measured metrics. Stop a response, then start another; no late text should enter the new turn.
- Change response size, threads and context, save settings, and regenerate. Invalid limits must show an error. GPU layers must not be accepted in this CPU build.
- Switch models while idle. Only the selected model should remain loaded. Remove an installed model only after confirming the dialog. Original imported files must remain untouched.
- Pause a download, close/reopen Atlas, then resume. Confirm byte progress continues when the server supports Range. A checksum mismatch must remove the corrupted partial, never install it.
- Run **Quick · 10 cases** on one model before a full run. Then select two installed models and compare sequentially. Inspect raw responses and manually rate subjective categories. Export JSON and CSV. Incomplete scores must stay provisional.
- Run the full 100-case suite with one repetition first; it can take a long time and heat the phone. Keep Atlas visible. Check that no real reminders, transactions, trips or music state were changed by a benchmark.
- Save ratings, leave/reopen the Lab and inspect recent history. A custom prompt run should not persist automatically. Clear benchmark history and verify it is gone.

## Voice and privacy

1. Keep existing wake-word sensitivity/activation mode unchanged for a baseline. Test manual voice first, then Hey Atlas/Assistant activation already configured on the phone.
2. Pause/resume music through existing deterministic handlers. Ask an open-ended question and verify local conversational fallback with cloud consent disabled.
3. Verify speech begins at complete sentences, never reads `<think>` blocks or JSON, and follow-up listening waits for speech/generation to finish.
4. Stop the session during generation/TTS. No stale response should speak into the next session. Place a phone call or use another microphone app and check single-owner recovery.
5. Lock the phone. Private trip/finance/memory requests must remain blocked. General conversation must not include previous unlocked conversation history. Test screen-off execution separately; a foreground service does not guarantee uninterrupted execution under every OEM policy.
6. In the Lab, voice input must either obtain exclusive Atlas audio ownership or explain that another Atlas session is using it. It must not silently create a second recorder.
7. Ask for a sensitive foreground change. A proposal must request the existing confirmation; no success receipt may appear before the action actually completes.

## Performance and endurance record

Test 2/4/6 threads and 1024/2048/4096 contexts sequentially, starting at 2 threads/1024 for a cool baseline. Keep prompts, response limit, sampling and other apps consistent. Record cold load, warm first token, prompt throughput, generation throughput, first sentence, process PSS and thermal status. Targets such as sub-second warm first token or 15 tok/s are goals, not current results.

Run 15-minute conversations, then longer screen-off/background sessions. Record Android battery usage over comparable long intervals with wake mode held constant. Short integer battery-level changes are not a reliable model-efficiency benchmark. Let the phone cool between models. Check behavior under low free RAM, severe thermal status, interrupted networking and app process termination. Offline deterministic features must continue to work without a selected model.

Export diagnostics/benchmark JSON from the Lab. Review any custom prompts or generated text before sharing the file. Never include cloud keys or a private vault backup in a bug report.

## New recovery and privacy checks

- Import a large GGUF, watch progress, cancel during the copy, and verify the original remains present. Retry from that original. Kill/reopen Atlas midway: only its orphan import partial is cleaned.
- Interrupt Wi-Fi during a download. Observe automatic bounded retry; resume after the retry window or process restart. Free storage after a low-storage failure and retry; valid downloaded partial bytes must remain reusable.
- Switch/remove a model while a generation is finishing. No new generation may start between unload and selection/removal. A hot resident model must refuse a new request at severe thermal status.
- Have an unlocked conversation containing a distinctive private phrase, then lock/screen off before generation or TTS completes. The reply must stop. Start a new locked general question: no unlocked history may be present. Unlock again: the locked session must not restore the earlier private context.
- Inspect **Atlas AI → Voice Pipeline Latency Telemetry** after a real voice turn. Recognition/router/load/prompt/token/sentence/TTS/follow-up stages should correspond to the actual path. A deterministic reply legitimately has no model stages. Callbacks are not microphone-measured audible latency.

For emulator setup and actual model instrumentation, use [WINDOWS-TESTS.md](WINDOWS-TESTS.md). There is no physical-device validation yet.
