import { parseLocalEnvelope, LOCAL_RESPONSE_RULES } from "./lab/envelope";
import type { AtlasAction } from "./gateway";
import {
  callSecureCloudAi,
  getVoiceCloudStatusNative,
  isWakeWordNativeSupported,
} from "../wakeword/atlasWakeWord";
import { generateLocal, runtimeStatus } from "./native";
import {
  buildPersonalitySystemInstructions,
  loadPersonalityConfig,
  type AtlasPersonalityConfig,
} from "./personality";
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
  action?: AtlasAction;
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
  localStatusFn: typeof runtimeStatus = runtimeStatus,
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
        cloudProvider:
          nativeStatus.cloudProvider === "openai" ? "openai" : "gemini",
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
  return window.localStorage.getItem(WEB_PROVIDER_KEY) === "openai"
    ? "openai"
    : "gemini";
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

function buildBoundedHistory(
  session: SessionMemory,
): Array<{ role: "user" | "assistant"; text: string }> {
  return session.turns
    .slice(-MAX_BOUNDED_TURNS)
    .map((t) => ({ role: t.role, text: t.text }));
}

function buildSystemPrompt(
  session: SessionMemory,
  personality: AtlasPersonalityConfig,
  userText: string,
): string {
  const base = buildPersonalitySystemInstructions(personality, userText);
  const contextBits = [
    session.activeTripTitle
      ? `Active trip: ${session.activeTripTitle}${session.lastTripDay ? ` (Day ${session.lastTripDay})` : ""}.`
      : "",
    session.sessionSummary ? `Session summary: ${session.sessionSummary}.` : "",
    "Never invent Life Atlas vault data (trips, balances, expenses, or music). Keep replies natural and concise (1-3 spoken sentences).",
  ].filter(Boolean);
  return `${base}\n${contextBits.join(" ")}`;
}

async function queryWebCloudAi(options: {
  provider: CloudAiProvider;
  apiKey: string;
  systemPrompt: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  userText: string;
}): Promise<string | null> {
  if (!options.apiKey.trim()) return null;

  if (options.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 180,
        messages: [
          { role: "system", content: options.systemPrompt },
          ...options.history.map((h) => ({ role: h.role, content: h.text })),
          { role: "user", content: options.userText },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  const contents = [
    ...options.history.map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    })),
    { role: "user", parts: [{ text: options.userText }] },
  ];
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 180, temperature: 0.7 },
      }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

export async function routeGenerativeReply(
  req: ProviderGenerationRequest,
  deps?: {
    runtimeStatusFn?: typeof runtimeStatus;
    generateLocalFn?: typeof generateLocal;
    secureCloudFn?: typeof callSecureCloudAi;
  },
): Promise<ProviderGenerationResult | null> {
  const personality = req.personality ?? loadPersonalityConfig();
  const systemPrompt = buildSystemPrompt(
    req.session,
    personality,
    req.userText,
  );
  const history = buildBoundedHistory(req.session);

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
      await genFn(
        prompt,
        abort.signal,
        (tok) => {
          if (generated.length < 1000) generated += tok;
        },
        [
          {
            role: "system",
            content:
              systemPrompt +
              "\n" +
              LOCAL_RESPONSE_RULES +
              "\nSupported action kinds and descriptions: " +
              JSON.stringify([
                { kind: "music.search", query: "search words" },
                { kind: "music.pause" },
                { kind: "music.resume" },
                { kind: "music.next" },
                { kind: "music.previous" },
                { kind: "music.state" },
                { kind: "trips.list" },
                { kind: "trips.search", query: "destination" },
                { kind: "trips.itinerary", id: "known ID only" },
                { kind: "trips.open", id: "known ID only" },
                { kind: "reminder.list" },
                {
                  kind: "reminder.create",
                  title: "required",
                  dueText: "optional",
                },
                { kind: "reminder.delete", id: "known ID only" },
                { kind: "finance.summary" },
                { kind: "control.status" },
                {
                  kind: "navigate",
                  section: "music | trips | finance | control | home | atlas",
                },
              ]),
          },
          ...history.map((t) => ({ role: t.role, content: t.text })),
          { role: "user", content: req.userText },
        ],
        true,
      );
      if (generated.trim()) {
        const envelope = parseLocalEnvelope(generated.trim());
        return {
          source: "llm.local",
          text: envelope.reply,
          ...(envelope.action ? { action: envelope.action } : {}),
        };
      }
    } catch {
      // Fall through cleanly to consented cloud or deterministic dialogue fallback
    }
  }

  // 2. Consented Cloud AI path (Android Keystore native proxy or volatile browser key)
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  if (!req.allowCloud || !online) return null;

  if (isWakeWordNativeSupported() || deps?.secureCloudFn) {
    try {
      const fn = deps?.secureCloudFn ?? callSecureCloudAi;
      const nativeResult = await fn({
        provider: req.cloudProvider,
        systemPrompt,
        history,
        userText: req.userText,
      });
      if (nativeResult.ok && nativeResult.replyText?.trim()) {
        const usedProvider =
          nativeResult.provider === "openai"
            ? "llm.cloud.openai"
            : "llm.cloud.gemini";
        return { source: usedProvider, text: nativeResult.replyText.trim() };
      }
    } catch {
      // Try secondary / web fallback if key available, else fall back cleanly
    }
  }

  const key = req.webSessionApiKey ?? volatileWebApiKey;
  if (key) {
    const primary: CloudAiProvider = req.cloudProvider ?? getWebCloudProvider();
    const reply = await queryWebCloudAi({
      provider: primary,
      apiKey: key,
      systemPrompt,
      history,
      userText: req.userText,
    }).catch(() => null);
    if (reply) {
      return {
        source: primary === "openai" ? "llm.cloud.openai" : "llm.cloud.gemini",
        text: reply,
      };
    }
  }

  return null;
}
