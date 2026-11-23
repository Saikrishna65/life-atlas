// Small preference readers shared by the launcher. Conversation planning and
// finance adapters are imported only when a voice command actually arrives.
import {
  getWebCloudConsent,
  getWebCloudProvider,
  getVolatileWebApiKey,
  purgeLegacyPlaintextApiKey,
  type CloudAiProvider,
} from "./providers";
export function getVoiceCloudConsent(): boolean {
  return getWebCloudConsent();
}
export function getVoiceCloudConfig(): {
  provider: CloudAiProvider;
  apiKey: string;
} {
  purgeLegacyPlaintextApiKey();
  return { provider: getWebCloudProvider(), apiKey: getVolatileWebApiKey() };
}
