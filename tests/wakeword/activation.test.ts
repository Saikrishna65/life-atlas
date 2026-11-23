import assert from "node:assert/strict";
import test from "node:test";
import {
  activationLabel,
  activationError,
  unavailableActivation,
  voiceActivation,
} from "../../src/lib/wakeword/activation";
test("web previews cannot enable automatic microphone or Google interception", async () => {
  const status = await voiceActivation.status();
  assert.equal(status.supported, false);
  assert.equal(status.mode, "off");
  assert.equal(status.listenerCapturing, false);
  assert.equal(status.observeOnly, true);
  assert.throws(
    () => voiceActivation.setMode("microphone"),
    /ANDROID_REQUIRED/,
  );
  assert.throws(
    () => voiceActivation.setMode("google-bridge", true),
    /ANDROID_REQUIRED/,
  );
  assert.deepEqual(await voiceActivation.consume(), { started: false });
});
test("activation readiness distinguishes stopped audio, missing accessibility, observation and armed experiment", () => {
  const status = {
    ...unavailableActivation,
    supported: true,
    microphoneGranted: true,
  };
  assert.match(activationLabel(status), /off/);
  assert.match(
    activationLabel({ ...status, mode: "microphone" }),
    /currently stopped/,
  );
  assert.match(
    activationLabel({ ...status, mode: "google-bridge" }),
    /Enable Atlas/,
  );
  const bridge = {
    ...status,
    mode: "google-bridge" as const,
    accessibilityEnabled: true,
    bridgeConnected: true,
  };
  assert.match(activationLabel(bridge), /Observe only/);
  assert.match(
    activationLabel({ ...bridge, observeOnly: false }),
    /validation pending/,
  );
  assert.match(
    activationLabel({ ...bridge, listenerCapturing: true }),
    /cannot activate/,
  );
  assert.match(
    activationLabel({ ...bridge, changing: true }),
    /Releasing audio/,
  );
});
test("settings errors expose fixed recovery guidance instead of raw service or transcript messages", () => {
  assert.match(
    activationError({ code: "AUDIO_RELEASE_TIMEOUT" }),
    /remains off/,
  );
  assert.match(
    activationError({ code: "OBSERVED_OVERLAY_REQUIRED" }),
    /Observe the assistant/,
  );
  assert.match(activationError({ code: "UNIMPLEMENTED" }), /updated build/);
  assert.ok(
    !activationError(new Error("Private spoken command")).includes(
      "Private spoken command",
    ),
  );
});
