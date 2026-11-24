import type {
  ChatMessage,
  GenerationResult,
  InferenceConfig,
} from "./lab/config";
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
export interface RuntimeStatus {
  device?: Record<string, unknown>;
  nativeHeapBytes?: number;
  batteryLevel?: number;
  batteryTemperatureC?: number;
  available: boolean;
  reason: string;
  engine: string;
  policy?: { idleSeconds: number; keepResident: boolean; streaming: boolean };
  state?: string;
  selected?: string;
  loaded?: string;
  busy?: boolean;
  availableMemoryBytes?: number;
  processPssBytes?: number;
  thermalStatus?: number;
  options?: Partial<InferenceConfig>;
}
interface AtlasNativePlugin {
  deviceState(): Promise<{ locked: boolean }>;
  runtimeStatus(): Promise<RuntimeStatus>;
  setPolicy(options: {
    policy: { idleSeconds: number; keepResident: boolean; streaming: boolean };
  }): Promise<void>;
  loadModel(): Promise<RuntimeStatus>;
  configure(options: { options: Partial<InferenceConfig> }): Promise<void>;
  resetContext(): Promise<void>;
  generate(options: {
    requestId: string;
    prompt?: string;
    messages?: ChatMessage[];
    maxTokens?: number;
    options?: Partial<InferenceConfig>;
    structured?: boolean;
  }): Promise<GenerationResult>;
  cancel(options: { requestId: string }): Promise<void>;
  unload(): Promise<void>;
  voiceStatus(): Promise<{
    recognition: boolean;
    speech: boolean;
    reason: string;
  }>;
  listen(options: { requestId: string }): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  stopVoice(): Promise<void>;
  addListener(
    event: "token" | "voice",
    listener: (event: {
      requestId?: string;
      token?: string;
      state?: string;
      text?: string;
      error?: string;
    }) => void,
  ): Promise<PluginListenerHandle>;
}
export const AtlasNative = registerPlugin<AtlasNativePlugin>("AtlasLocalAI");
export async function requireNativeTrust() {
  if (!Capacitor.isNativePlatform())
    throw new Error(
      "Local module actions are available inside the Android app.",
    );
  const { authorize } = await import("../security/authentication");
  await authorize("aiActions");
  if (typeof document !== "undefined" && document.visibilityState === "hidden")
    throw new Error("Return to Atlas to continue this action.");
}
export async function runtimeStatus(): Promise<RuntimeStatus> {
  if (
    !Capacitor.isNativePlatform() ||
    !Capacitor.isPluginAvailable("AtlasLocalAI")
  )
    return {
      available: false,
      engine: "none",
      reason:
        "On-device inference is unavailable. Use Intelligence Lab in the Android app to install and select a local GGUF model.",
    };
  return AtlasNative.runtimeStatus();
}
export async function generateLocal(
  prompt: string,
  signal: AbortSignal,
  onToken: (token: string) => void,
  messages?: ChatMessage[],
  structured = false,
) {
  if (prompt.length > 24000)
    throw new Error("Conversation context exceeds the local model limit.");
  const status = await runtimeStatus();
  if (!status.available) throw new Error(status.reason);
  if (signal.aborted) throw new Error("Generation canceled.");
  const requestId = crypto.randomUUID();
  const listener = await AtlasNative.addListener("token", (event) => {
    if (
      event.requestId === requestId &&
      !signal.aborted &&
      typeof event.token === "string"
    )
      onToken(event.token);
  });
  let rejectCanceled: (reason: Error) => void = () => {};
  const canceled = new Promise<never>((_resolve, reject) => {
    rejectCanceled = reject;
  });
  const cancel = () => {
    void AtlasNative.cancel({ requestId }).catch(() => {});
    rejectCanceled(new Error("Generation canceled."));
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) throw new Error("Generation canceled.");
    const result = await Promise.race([
      AtlasNative.generate({
        requestId,
        ...(messages ? { messages } : { prompt }),
        structured,
      }),
      canceled,
    ]);
    if (
      !status.policy?.streaming &&
      status.policy?.streaming === false &&
      result.text
    )
      onToken(result.text);
  } finally {
    signal.removeEventListener("abort", cancel);
    await listener.remove();
  }
}

/** Fresh native privacy check; inability to verify on Android fails closed. */
export async function deviceIsLocked(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await AtlasNative.deviceState()).locked !== false;
  } catch {
    return true;
  }
}
