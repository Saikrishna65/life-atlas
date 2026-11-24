export interface InferenceConfig {
  thinking: boolean;
  threads: number;
  context: number;
  maxTokens: number;
  batch: number;
  temperature: number;
  topP: number;
  topK: number;
  repetition: number;
  seed: number;
  gpuLayers: number;
  chatTemplate:
    | "model"
    | "chatml"
    | "llama3"
    | "gemma"
    | "qwen3"
    | "lfm2"
    | "lfm3";
}
export const DEFAULT_INFERENCE: Readonly<InferenceConfig> = Object.freeze({
  thinking: false,
  threads: 4,
  context: 2048,
  maxTokens: 128,
  batch: 128,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repetition: 1.1,
  seed: 4294967295,
  gpuLayers: 0,
  chatTemplate: "model",
});
export function validateInference(
  value: Partial<InferenceConfig>,
): InferenceConfig {
  const c = { ...DEFAULT_INFERENCE, ...value };
  if (typeof c.thinking !== "boolean")
    throw new Error("Thinking mode must be a boolean");
  for (const key of [
    "threads",
    "context",
    "maxTokens",
    "batch",
    "topK",
    "seed",
    "gpuLayers",
  ] as const)
    if (!Number.isInteger(c[key])) throw new Error(`${key} must be an integer`);
  if (
    c.threads < 1 ||
    c.threads > 8 ||
    c.context < 512 ||
    c.context > 4096 ||
    c.maxTokens < 1 ||
    c.maxTokens > 1024 ||
    c.maxTokens >= c.context ||
    c.batch < 1 ||
    c.batch > 512 ||
    c.batch > c.context ||
    c.topK < 1 ||
    c.topK > 200 ||
    c.seed < 0 ||
    c.seed > 4294967295
  )
    throw new Error("Settings exceed supported CPU limits");
  if (
    !Number.isFinite(c.temperature) ||
    c.temperature < 0 ||
    c.temperature > 2 ||
    !Number.isFinite(c.topP) ||
    c.topP <= 0 ||
    c.topP > 1 ||
    !Number.isFinite(c.repetition) ||
    c.repetition < 1 ||
    c.repetition > 2
  )
    throw new Error("Invalid sampling settings");
  if (c.gpuLayers !== 0)
    throw new Error("GPU acceleration is not compiled in this build");
  if (
    !["model", "chatml", "llama3", "gemma", "qwen3", "lfm2", "lfm3"].includes(
      c.chatTemplate,
    )
  )
    throw new Error("Unreviewed template override");
  return c;
}
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface InferenceMetrics {
  promptTokens: number;
  generatedTokens: number;
  promptMs: number;
  generationMs: number;
  totalMs: number;
  loadMs: number;
  firstTokenMs: number | null;
  firstSentenceMs: number | null;
  tokensPerSecond: number;
  promptTokensPerSecond: number;
  processPssBytes?: number;
  modelId?: string;
  backend: string;
}
export interface GenerationResult {
  text: string;
  metrics: InferenceMetrics;
  canceled: boolean;
  finishReason: string;
}
