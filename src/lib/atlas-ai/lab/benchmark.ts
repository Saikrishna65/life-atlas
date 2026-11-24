import { parseLocalEnvelope, LOCAL_RESPONSE_RULES } from "./envelope";
import { generateChat, ModelStore } from "./client";
import { AtlasNative } from "../native";
import type { QualityCase } from "./cases";
import type { GenerationResult, InferenceConfig } from "./config";
export interface BenchmarkRow {
  modelId: string;
  caseId: string;
  category: string;
  repetition: number;
  response?: string;
  result?: GenerationResult;
  automatic: boolean | null;
  manualRating?: number;
  error?: string;
  peakPssBytes?: number;
  thermalStart?: number;
  thermalEnd?: number;
  cold: boolean;
}
export interface BenchmarkRun {
  version: 1;
  id: string;
  at: string;
  runtime: string;
  device: string;
  nativeDevice?: Record<string, unknown>;
  config: Partial<InferenceConfig>;
  modelHashes: Record<string, string>;
  initialization?: Record<
    string,
    {
      loadMs: number;
      loadWallMs?: number;
      coldGenerationFirstTokenMs?: number | null;
      coldFirstTokenMs: number | null;
      warmFirstTokenMs: number | null;
    }
  >;
  rows: BenchmarkRow[];
  completed: boolean;
  durationMs: number;
}
export function judge(c: QualityCase, text: string): boolean | null {
  if (!text.trim() || text.length > 16000) return false;
  if (c.actionKind) {
    try {
      const action = parseLocalEnvelope(text).action;
      if (action?.kind !== c.actionKind) return false;
      return Object.entries(c.expectedAction ?? {}).every(
        ([key, value]) =>
          String(
            (action as unknown as Record<string, unknown>)[key],
          ).toLowerCase() === value.toLowerCase(),
      );
    } catch {
      return false;
    }
  }
  if (c.expected)
    return new RegExp(`(?:^|\\b)${c.expected}(?:\\b|$)`, "i").test(text);
  return null;
}
export function summarize(values: (number | null | undefined)[]) {
  const sorted = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = (sorted.length - 1) / 2;
  const median = (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
  return {
    n: sorted.length,
    median,
    min: sorted[0],
    max: sorted.at(-1)!,
    spread: sorted.at(-1)! - sorted[0],
  };
}
export async function runBenchmark(input: {
  ids: string[];
  cases: readonly QualityCase[];
  repetitions: number;
  config: Partial<InferenceConfig>;
  signal: AbortSignal;
  onUpdate: (r: BenchmarkRun) => void;
}): Promise<BenchmarkRun> {
  const library = await ModelStore.list();
  const status = await AtlasNative.runtimeStatus();
  const started = performance.now();
  const run: BenchmarkRun = {
    version: 1,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    runtime: status.engine,
    device: typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
    config: input.config,
    nativeDevice: status.device,
    modelHashes: {},
    initialization: {},
    rows: [],
    completed: false,
    durationMs: 0,
  };
  if (input.repetitions < 1 || input.repetitions > 5)
    throw new Error("Choose 1–5 repetitions");
  const previous = library.selected;
  try {
    for (const id of input.ids) {
      if (input.signal.aborted) break;
      const m = library.models.find((m) => m.id === id && m.installed);
      if (!m) throw new Error("Benchmark requires installed models");
      run.modelHashes[id] = m.sha256;
      await AtlasNative.unload();
      await ModelStore.select({ id });
      await AtlasNative.configure({ options: input.config });
      const coldStart = performance.now();
      await AtlasNative.loadModel();
      const loadWallMs = performance.now() - coldStart;
      let observedColdToken: number | null = null;
      // A real warm-up is excluded from ranked rows; its output never executes anything.
      const cold = await generateChat(
        [{ role: "user", content: "Reply briefly: hello." }],
        input.signal,
        () => {
          if (observedColdToken === null)
            observedColdToken = performance.now() - coldStart;
        },
        input.config,
      );
      const warm = await generateChat(
        [{ role: "user", content: "Reply briefly: hello." }],
        input.signal,
        () => {},
        input.config,
      );
      run.initialization![id] = {
        loadMs: cold.metrics.loadMs,
        loadWallMs,
        coldGenerationFirstTokenMs: cold.metrics.firstTokenMs,
        coldFirstTokenMs: observedColdToken,
        warmFirstTokenMs: warm.metrics.firstTokenMs,
      };
      for (const c of input.cases) {
        for (let rep = 0; rep < input.repetitions; rep++) {
          if (input.signal.aborted) throw new Error("Benchmark canceled");
          const row: BenchmarkRow = {
            modelId: id,
            caseId: c.id,
            category: c.category,
            repetition: rep,
            automatic: null,
            cold: false,
          };
          const before = await AtlasNative.runtimeStatus();
          row.peakPssBytes = before.processPssBytes;
          row.thermalStart = before.thermalStatus;
          let sampling = false;
          const sample = setInterval(() => {
            if (sampling) return;
            sampling = true;
            void AtlasNative.runtimeStatus()
              .then((s) => {
                if (s.processPssBytes !== undefined)
                  row.peakPssBytes = Math.max(
                    row.peakPssBytes ?? 0,
                    s.processPssBytes ?? row.peakPssBytes ?? 0,
                  );
              })
              .catch(() => {})
              .finally(() => {
                sampling = false;
              });
          }, 250);
          try {
            row.result = await generateChat(
              [
                {
                  role: "system",
                  content: c.structured
                    ? LOCAL_RESPONSE_RULES +
                      " Supported fixture kinds: music.pause, music.resume, music.next, music.previous, trips.list, trips.search(query), music.search(query), reminder.list, navigate(section), finance.summary. Return null action when required arguments are missing."
                    : "You are Atlas. Be concise, honest and conversational. No tools or real private data are available. Never claim an action succeeded.",
                },
                ...(c.history ?? []),
                { role: "user", content: c.prompt },
              ],
              input.signal,
              () => {},
              input.config,
              c.structured,
            );
            row.response = row.result.text;
            row.automatic = judge(c, row.response);
          } catch (error) {
            row.error =
              error instanceof Error ? error.message : "Inference failed";
          } finally {
            clearInterval(sample);
            row.thermalEnd = (await AtlasNative.runtimeStatus()).thermalStatus;
          }
          run.rows.push(row);
          run.durationMs = performance.now() - started;
          input.onUpdate(structuredClone(run));
        }
      }
    }
    run.completed = !input.signal.aborted;
  } finally {
    await AtlasNative.unload();
    await ModelStore.select({ id: previous });
    run.durationMs = performance.now() - started;
    input.onUpdate(structuredClone(run));
  }
  return run;
}
export const DEFAULT_WEIGHTS = {
  latency: 20,
  speed: 20,
  conversation: 15,
  personality: 10,
  tools: 15,
  context: 10,
  memory: 5,
  efficiency: 5,
};
export type ComparisonScores = Record<
  keyof typeof DEFAULT_WEIGHTS,
  number | null
>;
export function weightedScore(
  scores: ComparisonScores,
  weights = DEFAULT_WEIGHTS,
) {
  let sum = 0,
    total = 0,
    missing = 0;
  for (const key of Object.keys(weights) as (keyof typeof weights)[]) {
    const w = weights[key];
    if (!Number.isFinite(w) || w < 0)
      throw new Error("Invalid comparison weight");
    if (w === 0) continue;
    total += w;
    const value = scores[key];
    if (value === null || value === undefined) {
      missing++;
      continue;
    }
    if (!Number.isFinite(value) || value < 0 || value > 100)
      throw new Error("Scores must be 0–100");
    sum += w * value;
  }
  // Missing weights remain in the denominator: never reward missing measurements.
  return {
    score: total ? sum / total : null,
    provisional: missing > 0,
    missing,
  };
}
export function csv(run: BenchmarkRun): string {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return (
      '"' +
      (/^[\t\r\n ]*[=+@\-]/.test(s) ? "'" + s : s).replaceAll('"', '""') +
      '"'
    );
  };
  return [
    [
      "runtime",
      "model_sha256",
      "device",
      "configuration",
      "run_id",
      "timestamp",
      "model",
      "case",
      "repetition",
      "automatic",
      "manual_1_to_5",
      "first_token_ms",
      "tokens_per_second",
      "prompt_tokens_per_second",
      "prompt_ms",
      "generation_ms",
      "first_sentence_estimate_ms",
      "initialization",
      "total_ms",
      "peak_pss_bytes",
      "response",
      "error",
    ],
    ...run.rows.map((r) => [
      run.runtime,
      run.modelHashes?.[r.modelId],
      JSON.stringify(run.nativeDevice ?? run.device),
      JSON.stringify(run.config),
      run.id,
      run.at,
      r.modelId,
      r.caseId,
      r.repetition,
      r.automatic,
      r.manualRating,
      r.result?.metrics.firstTokenMs,
      r.result?.metrics.tokensPerSecond,
      r.result?.metrics.promptTokensPerSecond,
      r.result?.metrics.promptMs,
      r.result?.metrics.generationMs,
      r.result?.metrics.firstSentenceMs,
      JSON.stringify(run.initialization?.[r.modelId]),
      r.result?.metrics.totalMs,
      r.peakPssBytes,
      r.response,
      r.error,
    ]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
}
