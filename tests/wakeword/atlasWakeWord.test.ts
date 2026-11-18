import assert from "node:assert/strict";
import test from "node:test";
import {
  atlasWakeWordBridge,
  classifyActiveWakeModel,
  DEFAULT_UNAVAILABLE_MODEL,
  EXPERIMENT_SCENARIOS,
  isWakeWordNativeSupported,
  type WakeWordModelInfo,
} from "../../src/lib/wakeword/atlasWakeWord";

test("wakeword bridge reports non-native web environment cleanly without crashing", async () => {
  assert.equal(isWakeWordNativeSupported(), false);

  const status = await atlasWakeWordBridge.getListeningStatus();
  assert.equal(status.running, false);
  assert.equal(status.serviceState, "unavailable_web");
  assert.equal(status.loadedModel.isCustomHeyAtlasModel, false);

  const stats = await atlasWakeWordBridge.getWakeWordStats();
  assert.equal(stats.detectionCount, 0);
  assert.deepEqual(stats.detections, []);

  const report = await atlasWakeWordBridge.getDiagnosticReport();
  assert.equal(report.sdkInt, 0);
  assert.equal(report.assistantRole?.roleHeld, false);

  await assert.rejects(
    () => atlasWakeWordBridge.importCustomModel(0.5),
    /Android APK build/
  );
});

test("classifyActiveWakeModel never claims Hey Atlas when using Hey Jarvis test model", () => {
  const jarvisTestModel: WakeWordModelInfo = {
    modelId: "hey_jarvis_test",
    displayName: "Hey Jarvis v0.1 (Pipeline Test Model)",
    targetPhrase: "Hey Jarvis",
    isCustomHeyAtlasModel: false,
    sourceType: "bundled_test",
    modelPathOrAsset: "wakeword/hey_jarvis_v0.1.onnx",
    isAsset: true,
    sha256: "94a13cfe",
    threshold: 0.5,
    cooldownMs: 1500,
    requiredEmbeddingFrames: 16,
    licenseNote: "CC BY-NC-SA 4.0 test weights",
  };

  const classified = classifyActiveWakeModel(jarvisTestModel);
  assert.equal(classified.isTrueHeyAtlas, false);
  assert.match(classified.badgeText, /TEST MODEL/i);
  assert.match(classified.warningText ?? "", /Hey Jarvis/);
  assert.match(classified.warningText ?? "", /NOT a trained "Hey Atlas"/);
  assert.equal(classified.spokenPhraseLabel, "Hey Jarvis");
});

test("classifyActiveWakeModel marks imported custom Hey Atlas model as true active phrase", () => {
  const customModel: WakeWordModelInfo = {
    modelId: "custom_hey_atlas",
    displayName: "Custom Hey Atlas (.onnx)",
    targetPhrase: "Hey Atlas",
    isCustomHeyAtlasModel: true,
    sourceType: "imported_custom",
    modelPathOrAsset: "/data/user/0/com.lifeatlas.app/no_backup/wakeword/custom_hey_atlas.onnx",
    isAsset: false,
    sha256: "abcd",
    threshold: 0.52,
    cooldownMs: 1500,
    requiredEmbeddingFrames: 16,
    licenseNote: "User-imported custom ONNX model",
  };

  const classified = classifyActiveWakeModel(customModel);
  assert.equal(classified.isTrueHeyAtlas, true);
  assert.equal(classified.warningText, null);
  assert.equal(classified.spokenPhraseLabel, "Hey Atlas");

  const webFallback = classifyActiveWakeModel(DEFAULT_UNAVAILABLE_MODEL);
  assert.equal(webFallback.isTrueHeyAtlas, false);
});

test("EXPERIMENT_SCENARIOS covers Tests A through H in order", () => {
  assert.deepEqual(
    EXPERIMENT_SCENARIOS.map((s) => s.id),
    ["A", "B", "C", "D", "E", "F", "G", "H"]
  );
  for (const s of EXPERIMENT_SCENARIOS) {
    assert.ok(s.title.length > 0);
    assert.ok(s.expectedHonestOutcome.length > 0);
    assert.ok(s.steps.length >= 2);
  }
});
