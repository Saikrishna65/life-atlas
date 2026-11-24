import { Capacitor, registerPlugin } from "@capacitor/core";
import { AtlasNative } from "../native";
import type { ChatMessage, GenerationResult, InferenceConfig } from "./config";
import type { BenchmarkRun } from "./benchmark";
export interface StoredModel {
  id: string;
  name: string;
  bytes: number;
  sha256: string;
  license: string;
  licenseUrl?: string;
  installed: boolean;
  state: string;
  partialBytes: number;
  quantization?: string;
  architecture?: string;
  repository?: string;
  chatTemplate?: string;
  transfer?: {
    received: number;
    total: number;
    bytesPerSecond: number;
    error?: string;
  };
}
export interface ModelTransfer {
  id: string;
  name: string;
  kind: string;
  state: string;
  received: number;
  total: number;
  bytesPerSecond: number;
  error?: string;
}
export interface ModelLibrary {
  transfers?: ModelTransfer[];
  models: StoredModel[];
  selected: string;
  availableBytes: number;
}
export const ModelStore = registerPlugin<{
  saveBenchmark(o: { report: BenchmarkRun }): Promise<void>;
  listBenchmarks(): Promise<{ reports: BenchmarkRun[] }>;
  clearBenchmarks(o: { confirm: boolean }): Promise<void>;
  list(): Promise<ModelLibrary>;
  install(o: {
    id: string;
    consent: boolean;
    wifiOnly: boolean;
  }): Promise<void>;
  pause(o: { id: string }): Promise<void>;
  cancel(o: { id: string }): Promise<void>;
  select(o: { id: string }): Promise<void>;
  remove(o: { id: string; confirm: boolean }): Promise<void>;
  importModel(o: { consent: boolean }): Promise<{ transferId: string }>;
}>("AtlasModels");
export const supportsLab = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AtlasLocalAI");
export async function generateChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  onToken: (t: string) => void,
  options?: Partial<InferenceConfig>,
  structured = false,
): Promise<GenerationResult> {
  if (signal.aborted) throw new Error("Generation canceled");
  const requestId = crypto.randomUUID();
  const listener = await AtlasNative.addListener("token", (e) => {
    if (e.requestId === requestId && !signal.aborted && e.token)
      onToken(e.token);
  });
  const abort = () => {
    void AtlasNative.cancel({ requestId });
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new Error("Generation canceled");
    const result = await AtlasNative.generate({
      requestId,
      messages,
      options,
      structured,
    });
    if (signal.aborted || result.canceled)
      throw new Error("Generation canceled");
    return result;
  } finally {
    signal.removeEventListener("abort", abort);
    await listener.remove();
  }
}
