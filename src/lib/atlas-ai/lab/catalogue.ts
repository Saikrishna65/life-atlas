import { MODEL_CATALOGUE } from "../model-catalogue";
export { MODEL_CATALOGUE };
const order = [
  "lfm3-17b-q4",
  "dolphin-3-1b-q4",
  "qwen3-17b-q8",
  "huihui-qwen35-2b-q4",
  "dolphin-3-3b-q4",
  "lfm25-12b-q4",
  "huihui-qwen35-08b-q4",
  "qwen35-2b-q4",
  "arcee-lite",
  "huihui-qwen35-4b-q4",
  "gemma4-e2b-q4",
  "bonsai-4b-q1",
];
export const MODEL_CANDIDATES = order.map((id) => {
  const model = MODEL_CATALOGUE.find((m) => m.id === id);
  return model
    ? {
        id,
        name: model.name,
        status: `Artifact, license, architecture and quantization reviewed; ${model.bytes >= 2500000000 ? "high memory demand; " : ""}real inference pending`,
      }
    : {
        id,
        name: "Arcee Lite · 1.7B",
        status:
          "Blocked: no exact publisher GGUF identity/hash could be verified. Do not substitute an unrelated Arcee model.",
      };
});
