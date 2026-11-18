import { createLocalAdapters, type LocalPlayback } from "./local-adapters";
import type { LocalAdapter } from "./gateway";
import { runConversationTurn } from "./conversation";
import {
  clearVoiceCloudKeyNative,
  isWakeWordNativeSupported,
  saveEncryptedMemoriesNative,
  saveVoiceCloudConfigNative,
} from "../wakeword/atlasWakeWord";
import {
  getVolatileWebApiKey,
  getWebCloudConsent,
  getWebCloudProvider,
  purgeLegacyPlaintextApiKey,
  setVolatileWebApiKey,
  setWebCloudConsent,
  setWebCloudProvider,
  type CloudAiProvider,
} from "./providers";
import type { AtlasPersonalityConfig } from "./personality";

export type { CloudAiProvider };

export interface VoiceTurn {
  role: "user" | "assistant";
  text: string;
}

export interface VoiceAssistantSessionContext {
  sessionId: string;
  turns: VoiceTurn[];
  activeTripId?: string;
  activeTripTitle?: string;
  lastTripDay?: number;
}

export interface VoiceAssistantReply {
  replyText: string;
  endSession: boolean;
  actionExecuted?: string;
  requiresConfirmation?: boolean;
  confirmationDescription?: string;
}

export function getVoiceCloudConsent(): boolean {
  return getWebCloudConsent();
}

export function setVoiceCloudConsent(enabled: boolean): void {
  setWebCloudConsent(enabled);
  purgeLegacyPlaintextApiKey();
  if (isWakeWordNativeSupported()) {
    void saveVoiceCloudConfigNative({
      cloudConsent: enabled,
      cloudProvider: getWebCloudProvider(),
    }).catch(() => {});
  }
}

export function getVoiceCloudConfig(): { provider: CloudAiProvider; apiKey: string } {
  purgeLegacyPlaintextApiKey();
  return {
    provider: getWebCloudProvider(),
    apiKey: getVolatileWebApiKey(),
  };
}

export async function setVoiceCloudConfig(provider: CloudAiProvider, apiKey: string): Promise<void> {
  setWebCloudProvider(provider);
  purgeLegacyPlaintextApiKey();
  const cleanKey = apiKey.trim();

  if (isWakeWordNativeSupported()) {
    // Store API key strictly in Android Keystore via AtlasVoiceSecureStore; never keep in WebView/localStorage.
    setVolatileWebApiKey("");
    await saveVoiceCloudConfigNative({
      cloudConsent: getWebCloudConsent(),
      cloudProvider: provider,
      ...(cleanKey ? { cloudApiKey: cleanKey } : {}),
    });
    return;
  }

  setVolatileWebApiKey(cleanKey);
}

export async function clearVoiceCloudConfigKey(): Promise<void> {
  purgeLegacyPlaintextApiKey();
  setVolatileWebApiKey("");
  if (isWakeWordNativeSupported()) {
    await clearVoiceCloudKeyNative().catch(() => {});
  }
}

export async function processVoiceTurn(options: {
  sessionId: string;
  transcript: string;
  isLocked: boolean;
  player: () => LocalPlayback;
  navigate: (href: string) => void;
  adapter?: LocalAdapter;
  personality?: AtlasPersonalityConfig;
  allowCloud?: boolean;
}): Promise<VoiceAssistantReply> {
  purgeLegacyPlaintextApiKey();
  const adapter = options.adapter ?? createLocalAdapters(options.player, options.navigate);
  const res = await runConversationTurn({
    sessionId: options.sessionId,
    transcript: options.transcript,
    isLocked: options.isLocked,
    adapter,
    personality: options.personality,
    allowCloud: options.allowCloud,
    memoryBridge: isWakeWordNativeSupported()
      ? { saveEncryptedMemories: saveEncryptedMemoriesNative }
      : undefined,
  });

  return {
    replyText: res.replyText,
    endSession: res.endSession,
    actionExecuted: res.actionExecuted,
    requiresConfirmation: res.requiresConfirmation,
    confirmationDescription: res.confirmationDescription,
  };
}
