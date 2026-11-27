import {
  callSecureCloudAi,
  getVoiceCloudStatusNative,
  isWakeWordNativeSupported,
} from "../wakeword/atlasWakeWord";
import { generateLocal, runtimeStatus } from "./native";
import { buildPersonalitySystemInstructions, loadPersonalityConfig, type AtlasPersonalityConfig } from "./personality";
import type { SessionMemory } from "./memory";

export type CloudAiProvider = "gemini" | "openai";

export interface ProviderGenerationRequest {
  userText: string;
  session: SessionMemory;
  personality?: AtlasPersonalityConfig;
  allowCloud: boolean;
  cloudProvider?: CloudAiProvider;
  webSessionApiKey?: string;
}

export interface ProviderGenerationResult {
  source: "llm.local" | "llm.cloud.gemini" | "llm.cloud.openai";
  text: string;
}

export interface ProviderRoutingReport {
  localAvailable: boolean;
  localReason: string;
  cloudConsent: boolean;
  cloudProvider: CloudAiProvider;
  hasNativeSecureKey: boolean;
  online: boolean;
}

const MAX_BOUNDED_TURNS = 8;

export async function inspectProviderAvailability(
  localStatusFn: typeof runtimeStatus = runtimeStatus
): Promise<ProviderRoutingReport> {
  const rt = await localStatusFn().catch(() => ({
    available: false,
    reason: "Local AI runtime unavailable.",
    engine: "none",
  }));

  const online = typeof navigator === "undefined" ? false : navigator.onLine;
  if (isWakeWordNativeSupported()) {
    try {
      const nativeStatus = await getVoiceCloudStatusNative();
      return {
        localAvailable: rt.available,
        localReason: rt.reason,
        cloudConsent: nativeStatus.cloudConsent,
        cloudProvider: nativeStatus.cloudProvider === "openai" ? "openai" : "gemini",
        hasNativeSecureKey: nativeStatus.hasCloudApiKey,
        online,
      };
    } catch {
      // Fall through to browser state
    }
  }

  return {
    localAvailable: rt.available,
    localReason: rt.reason,
    cloudConsent: getWebCloudConsent(),
    cloudProvider: getWebCloudProvider(),
    hasNativeSecureKey: false,
    online,
  };
}

const WEB_CONSENT_KEY = "atlas_voice_cloud_consent_v1";
const WEB_PROVIDER_KEY = "atlas_voice_cloud_provider_v1";
let volatileWebApiKey = "";

export function getWebCloudConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WEB_CONSENT_KEY) === "true";
}

export function setWebCloudConsent(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEB_CONSENT_KEY, enabled ? "true" : "false");
}

export function getWebCloudProvider(): CloudAiProvider {
  if (typeof window === "undefined") return "gemini";
  return window.localStorage.getItem(WEB_PROVIDER_KEY) === "openai" ? "openai" : "gemini";
}

export function setWebCloudProvider(provider: CloudAiProvider): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEB_PROVIDER_KEY, provider);
}

export function setVolatileWebApiKey(apiKey: string): void {
  volatileWebApiKey = apiKey.trim();
}

export function getVolatileWebApiKey(): string {
  return volatileWebApiKey;
}

/** Purge any legacy Phase 2 plaintext API key left in localStorage. */
export function purgeLegacyPlaintextApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("atlas_voice_cloud_api_key_v1");
  } catch {
    // ignore storage access issues
  }
}

function buildBoundedHistory(session: SessionMemory): Array<{ role: "user" | "assistant"; text: string }> {
  return session.turns.slice(-MAX_BOUNDED_TURNS).map((t) => ({ role: t.role, text: t.text }));
}

function buildSystemPrompt(session: SessionMemory, personality: AtlasPersonalityConfig, userText: string): string {
  const turns = session.turns;
  const prior = turns.at(-1)?.role === 'user' && turns.at(-1)?.text === userText ? turns.slice(0, -1) : turns;
  const base = buildPersonalitySystemInstructions(personality, userText, prior.filter(t => t.role === 'user').map(t => t.text));
  const contextBits = [
    session.activeTripTitle ? `Active trip: ${session.activeTripTitle}${session.lastTripDay ? ` (Day ${session.lastTripDay})` : ""}.` : "",
    session.sessionSummary ? `Session summary: ${session.sessionSummary}.` : "",
    "Never invent Life Atlas vault data (trips, balances, expenses, or music). Keep replies natural and concise (1-3 spoken sentences).",
  ].filter(Boolean);
  return `${base}\n${contextBits.join(" ")}`;
}

// Legacy automatic cloud transport removed. Explicit requests use cloud-approval.ts.
export async function routeGenerativeReply(
  req: ProviderGenerationRequest,
  deps?: {
    runtimeStatusFn?: typeof runtimeStatus;
    generateLocalFn?: typeof generateLocal;
    secureCloudFn?: typeof callSecureCloudAi;
  }
): Promise<ProviderGenerationResult | null> {
  const personality = req.personality ?? loadPersonalityConfig();
  const systemPrompt = buildSystemPrompt(req.session, personality, req.userText);
  const history = buildBoundedHistory(req.session);
  if (history.at(-1)?.role === 'user' && history.at(-1)?.text === req.userText) history.pop();

  // 1. Local LLM check (strictly honest; no model loaded => skipped cleanly)
  const rtFn = deps?.runtimeStatusFn ?? runtimeStatus;
  const rt = await rtFn().catch(() => ({
    available: false,
    reason: "Local AI runtime unavailable.",
    engine: "none",
  }));

  if (rt.available) {
    try {
      const genFn = deps?.generateLocalFn ?? generateLocal;
      const historyLines = history
        .map((t) => `${t.role === "user" ? "User" : "Atlas"}: ${t.text}`)
        .join("\n");
      const prompt = `${systemPrompt}\n${historyLines}\nUser: ${req.userText}\nAtlas:`;
      const abort = new AbortController();
      let generated = "";
      await genFn(prompt, abort.signal, (tok) => {
        if (generated.length < 1000) generated += tok;
      });
      if (generated.trim()) {
        return { source: "llm.local", text: generated.trim() };
      }
    } catch {
      // Fall through to deterministic local dialogue. Never send an automatic cloud request.
    }
  }

  // Global preferences and injected providers are not per-request approval.
  // Native and browser automatic cloud calls are intentionally disabled.
  return null;
}
