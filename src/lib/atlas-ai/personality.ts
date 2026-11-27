import { classifyCompanionTurn, companionInstructions, teasingPaused } from "./companion-engine";

export type ResponseLengthPref = "brief" | "balanced" | "detailed" | "adaptive";

/**
 * Configurable companion personality traits (strictly separated from safety & permission policies).
 */
export interface AtlasPersonalityConfig {
  humor: number; // 0..10
  playfulness: number; // 0..10
  sweetness: number; // 0..10
  directness: number; // 0..10
  responseLength: ResponseLengthPref;
  energy: number; // 0..10
  formality: number; // 0..10 (0 = casual, 10 = formal)
  teasing: number; // 0..10
  proactivity: number; // 0..10
  // Optional on legacy profiles; normalization resolves all four fields.
  roasting?: number;
  profanity?: number;
  strictness?: number;
  expressiveness?: number;
}
export type ResolvedAtlasPersonality = AtlasPersonalityConfig & Required<Pick<AtlasPersonalityConfig, "roasting" | "profanity" | "strictness" | "expressiveness">>;

export const DEFAULT_ATLAS_PERSONALITY: ResolvedAtlasPersonality = {
  humor: 10,
  playfulness: 7,
  sweetness: 10,
  directness: 7,
  responseLength: "adaptive",
  energy: 7,
  formality: 2,
  teasing: 4,
  proactivity: 6,
  roasting: 10,
  profanity: 10,
  strictness: 10,
  expressiveness: 10,
};

const STORAGE_KEY = "atlas_voice_personality_v2";

export function clampTrait(value: unknown, fallback: number): number {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function normalizePersonality(raw?: Partial<AtlasPersonalityConfig> | null): ResolvedAtlasPersonality {
  if (!raw) return {...DEFAULT_ATLAS_PERSONALITY};
  const len: ResponseLengthPref =
    raw.responseLength === "brief" || raw.responseLength === "detailed" || raw.responseLength === "adaptive" || raw.responseLength === "balanced" ? raw.responseLength : "balanced";
  return {
    humor: clampTrait(raw?.humor, DEFAULT_ATLAS_PERSONALITY.humor),
    playfulness: clampTrait(raw?.playfulness, DEFAULT_ATLAS_PERSONALITY.playfulness),
    sweetness: clampTrait(raw?.sweetness, DEFAULT_ATLAS_PERSONALITY.sweetness),
    directness: clampTrait(raw?.directness, DEFAULT_ATLAS_PERSONALITY.directness),
    responseLength: len,
    energy: clampTrait(raw?.energy, DEFAULT_ATLAS_PERSONALITY.energy),
    formality: clampTrait(raw?.formality, DEFAULT_ATLAS_PERSONALITY.formality),
    teasing: clampTrait(raw?.teasing, DEFAULT_ATLAS_PERSONALITY.teasing),
    proactivity: clampTrait(raw?.proactivity, DEFAULT_ATLAS_PERSONALITY.proactivity),
    roasting: clampTrait(raw?.roasting, clampTrait(raw?.teasing, 4)),
    profanity: clampTrait(raw?.profanity, 0),
    strictness: clampTrait(raw?.strictness, 0),
    expressiveness: clampTrait(raw?.expressiveness, clampTrait(raw?.energy, 7)),
  };
}

export function loadPersonalityConfig(): ResolvedAtlasPersonality {
  if (typeof window === "undefined") return { ...DEFAULT_ATLAS_PERSONALITY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ATLAS_PERSONALITY };
    return normalizePersonality(JSON.parse(raw) as Partial<AtlasPersonalityConfig>);
  } catch {
    return { ...DEFAULT_ATLAS_PERSONALITY };
  }
}

export function savePersonalityConfig(config: Partial<AtlasPersonalityConfig>): ResolvedAtlasPersonality {
  const next = normalizePersonality({ ...loadPersonalityConfig(), ...config });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function buildPersonalitySystemInstructions(
  config: AtlasPersonalityConfig,
  userUtterance = "",
  priorUserMessages: readonly string[] = []
): string {
  const profile = normalizePersonality(config);
  const route = classifyCompanionTurn(userUtterance);
  const base = companionInstructions(profile, route, teasingPaused(priorUserMessages, userUtterance));
  const formality = profile.formality >= 7 ? "Use polite, composed English." : "Use relaxed, everyday English.";
  const length = profile.responseLength === "brief"
    ? "Use one short sentence unless essential accuracy requires more."
    : profile.responseLength === "detailed"
      ? "Give useful detail, not filler; use clear paragraphs for complex requests."
      : profile.responseLength === "adaptive"
        ? "Match length to the request: one to three short sentences in casual chat, full explanation when requested."
        : "Usually one to three concise sentences; explain more when needed.";
  return [base, formality, length].join(" ");
}

const WAKE_GREETINGS_VARIED = [
  "Hey! What's up?",
  "Hey, I'm listening.",
  "Hi! How can I help?",
  "Yes, what's on your mind?",
];

export function pickWakeGreeting(config: AtlasPersonalityConfig, turnCount = 0): string {
  if (config.formality >= 7) return "Hello, how can I assist you?";
  if (config.playfulness >= 7 && turnCount % 4 === 1) return "Hey there! What are we up to?";
  return WAKE_GREETINGS_VARIED[turnCount % WAKE_GREETINGS_VARIED.length];
}
