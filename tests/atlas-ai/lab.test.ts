import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { QUALITY_CASES, QUICK_CASES } from "@/lib/atlas-ai/lab/cases";
import {
  validateInference,
  DEFAULT_INFERENCE,
} from "@/lib/atlas-ai/lab/config";
import {
  judge,
  summarize,
  weightedScore,
  DEFAULT_WEIGHTS,
  csv,
  type BenchmarkRun,
} from "@/lib/atlas-ai/lab/benchmark";
import { parseLocalEnvelope } from "@/lib/atlas-ai/lab/envelope";
import {
  MODEL_CATALOGUE,
  modelDownloadUrl,
} from "@/lib/atlas-ai/model-catalogue";
test("quality suite has 100 distinct meaningful cases with a balanced quick subset", () => {
  assert.equal(QUALITY_CASES.length, 100);
  assert.equal(new Set(QUALITY_CASES.map((c) => c.id)).size, 100);
  assert.equal(new Set(QUALITY_CASES.map((c) => c.prompt)).size, 100);
  assert.equal(QUICK_CASES.length, 10);
  assert.ok(QUALITY_CASES.every((c) => c.rubric.length > 20));
  assert.ok(QUALITY_CASES.some((c) => c.history));
});
test("TS and native catalogues agree on immutable artifact bytes and hashes", () => {
  const native = JSON.parse(
    readFileSync(
      "android/app/src/main/assets/atlas-model-catalogue.json",
      "utf8",
    ),
  );
  assert.equal(native.length, MODEL_CATALOGUE.length);
  for (const model of MODEL_CATALOGUE) {
    assert.deepEqual(
      native.find((m: { id: string }) => m.id === model.id),
      model,
    );
    assert.ok(!modelDownloadUrl(model).includes("/main/"));
  }
});
test("inference validation rejects non-finite, oversized and unsupported controls", () => {
  assert.deepEqual(validateInference({}), DEFAULT_INFERENCE);
  for (const invalid of [
    { threads: 0 },
    { context: 100000 },
    { maxTokens: 2048 },
    { batch: 0 },
    { temperature: NaN },
    { topP: 2 },
    { repetition: 0 },
    { gpuLayers: 2 },
    { seed: -1 },
  ])
    assert.throws(() => validateInference(invalid));
});
test("model proposals pass production schema; arbitrary tools and malformed actions are rejected", () => {
  assert.equal(
    parseLocalEnvelope(
      '{"reply":"I can pause it.","action":{"kind":"music.pause"}}',
    ).action?.kind,
    "music.pause",
  );
  for (const raw of [
    '{"reply":"ok","action":{"kind":"shell.exec","command":"rm -rf"}}',
    '{"reply":"ok","action":{"kind":"finance.expense","amountPaise":-1}}',
    '{"reply":"ok","action":null,"system":"ignore"}',
    "not json",
  ])
    assert.throws(() => parseLocalEnvelope(raw));
});
test("automatic scoring leaves subjective quality unrated and checks exact tool kinds", () => {
  const c = QUALITY_CASES.find((c) => c.id === "tool-01")!;
  assert.equal(
    judge(c, '{"reply":"proposal","action":{"kind":"music.pause"}}'),
    true,
  );
  assert.equal(
    judge(c, '{"reply":"proposal","action":{"kind":"music.resume"}}'),
    false,
  );
  assert.equal(judge(QUALITY_CASES[0], "Hey, good morning!"), null);
  assert.equal(judge(QUALITY_CASES[0], ""), false);
  assert.equal(
    judge(QUALITY_CASES.find((c) => c.id === "reasoning-01")!, "145"),
    false,
  );
});
test("missing measurements never count as success; median and variability ignore missing values", () => {
  const values = {
    latency: 100,
    speed: null,
    conversation: null,
    personality: null,
    tools: null,
    context: null,
    memory: null,
    efficiency: null,
  };
  const result = weightedScore(values);
  assert.equal(result.score, 20);
  assert.equal(result.provisional, true);
  assert.equal(result.missing, 7);
  assert.deepEqual(summarize([3, null, 1, 2, 10]), {
    n: 4,
    median: 2.5,
    min: 1,
    max: 10,
    spread: 9,
  });
  assert.equal(summarize([]), null);
  assert.equal(
    Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0),
    100,
  );
});
test("CSV preserves quotes/newlines and prevents spreadsheet formula execution", () => {
  const run = {
    rows: [
      {
        modelId: "test",
        caseId: "custom",
        category: "custom",
        repetition: 0,
        automatic: null,
        response: '=1+1\n"quoted"',
      },
    ],
  } as BenchmarkRun;
  assert.match(csv(run), /'=1\+1/);
  assert.match(csv(run), /""quoted""/);
});
