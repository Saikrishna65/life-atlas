import { MODEL_CATALOGUE } from "../model-catalogue";
export { MODEL_CATALOGUE };
export const MODEL_CANDIDATES = [
  { name: "LFM3 · 1.7B", id: "lfm3-17b-q4", status: "artifact verified" },
  {
    name: "Dolphin 3.0 · 1B",
    id: "dolphin-3-1b-q4",
    status: "artifact verified",
  },
  {
    name: "Qwen3 · 1.7B",
    id: "qwen3-17b-q8",
    status: "artifact verified · official Q8_0",
  },
  {
    name: "Huihui Qwen3.5 · 2B abliterated",
    status: "Repository found; artifact and license review pending",
  },
  {
    name: "Dolphin 3.0 · 3B",
    id: "dolphin-3-3b-q4",
    status: "artifact verified",
  },
  {
    name: "LFM2.5 · 1.2B Instruct",
    status: "Artifact, license and template review pending",
  },
  {
    name: "Huihui Qwen3.5 · 0.8B abliterated",
    status: "Artifact and source review pending",
  },
  {
    name: "Qwen3.5 · 2B",
    status: "Architecture present; exact artifact review pending",
  },
  {
    name: "Arcee Lite · 1.7B",
    status: "Exact model identity and artifact review pending",
  },
  {
    name: "Huihui Qwen3.5 · 4B abliterated",
    status: "Review pending; high memory risk on an 8GB phone",
  },
  {
    name: "Gemma 4 E2B",
    status: "Architecture present; artifact, license and memory review pending",
  },
  {
    name: "Bonsai · 4B 1-bit",
    status: "Packing/backend and artifact compatibility unverified",
  },
] as const;
