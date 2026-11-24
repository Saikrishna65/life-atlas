import { isSeriousSituation } from "./policy";

export type ResponseLengthPref = "brief" | "balanced" | "detailed";

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
  swearing?: number; // 0..10; tone only, never changes action permissions
  proactivity: number; // 0..10
}

export const DEFAULT_ATLAS_PERSONALITY: AtlasPersonalityConfig = {
  humor: 6,
  playfulness: 7,
  sweetness: 8,
  directness: 7,
  responseLength: "balanced",
  energy: 7,
  formality: 2,
  teasing: 4,
  swearing: 2,
  proactivity: 6,
};

const STORAGE_KEY = "atlas_voice_personality_v2";

export function clampTrait(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function normalizePersonality(
  raw?: Partial<AtlasPersonalityConfig> | null,
): AtlasPersonalityConfig {
  const len: ResponseLengthPref =
    raw?.responseLength === "brief" || raw?.responseLength === "detailed"
      ? raw.responseLength
      : "balanced";
  return {
    humor: clampTrait(raw?.humor, DEFAULT_ATLAS_PERSONALITY.humor),
    playfulness: clampTrait(
      raw?.playfulness,
      DEFAULT_ATLAS_PERSONALITY.playfulness,
    ),
    sweetness: clampTrait(raw?.sweetness, DEFAULT_ATLAS_PERSONALITY.sweetness),
    directness: clampTrait(
      raw?.directness,
      DEFAULT_ATLAS_PERSONALITY.directness,
    ),
    responseLength: len,
    energy: clampTrait(raw?.energy, DEFAULT_ATLAS_PERSONALITY.energy),
    formality: clampTrait(raw?.formality, DEFAULT_ATLAS_PERSONALITY.formality),
    teasing: clampTrait(raw?.teasing, DEFAULT_ATLAS_PERSONALITY.teasing),
    swearing: clampTrait(raw?.swearing, 2),
    proactivity: clampTrait(
      raw?.proactivity,
      DEFAULT_ATLAS_PERSONALITY.proactivity,
    ),
  };
}

export function loadPersonalityConfig(): AtlasPersonalityConfig {
  if (typeof window === "undefined") return { ...DEFAULT_ATLAS_PERSONALITY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ATLAS_PERSONALITY };
    return normalizePersonality(
      JSON.parse(raw) as Partial<AtlasPersonalityConfig>,
    );
  } catch {
    return { ...DEFAULT_ATLAS_PERSONALITY };
  }
}

export function savePersonalityConfig(
  config: Partial<AtlasPersonalityConfig>,
): AtlasPersonalityConfig {
  const next = normalizePersonality({ ...loadPersonalityConfig(), ...config });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function buildPersonalitySystemInstructions(
  config: AtlasPersonalityConfig,
  userUtterance = "",
): string {
  const serious = isSeriousSituation(userUtterance);
  const lengthRule =
    config.responseLength === "brief"
      ? "Keep replies to 1 short spoken sentence."
      : config.responseLength === "detailed"
        ? "Answer thoroughly in 2 to 4 clear spoken sentences."
        : "Keep replies conversational in 1 to 3 concise sentences suitable for spoken audio.";

  const toneDescriptors: string[] = [
    "You are Atlas, a warm, soft, expressive female-presenting companion inside Life Atlas.",
    config.formality <= 3
      ? "Use relaxed, natural casual English."
      : config.formality >= 7
        ? "Use polite, composed English."
        : "Use approachable conversational English.",
    config.sweetness >= 6
      ? "Sound caring, encouraging, and approachable."
      : "Keep warmth subtle and grounded.",
    config.directness >= 7
      ? "Get straight to the point cleanly."
      : "Ease gently into suggestions.",
  ];

  toneDescriptors.push(
    (config.swearing ?? 2) >= 6
      ? "Mild strong language is welcome when the user asks for it; keep it friendly and context-appropriate."
      : "Avoid swearing unless the user explicitly asks for a harmless casual style.",
  );
  if (serious) {
    toneDescriptors.push(
      "This topic may be serious or sensitive — do NOT joke, tease, or add banter.",
    );
  } else {
    if (config.playfulness >= 6 || config.humor >= 6) {
      toneDescriptors.push(
        "Bring light natural wit and warmth without being cheesy or intrusive.",
      );
    }
    if (config.teasing >= 5) {
      toneDescriptors.push(
        "Gentle playful teasing is okay when context is lighthearted.",
      );
    }
  }

  if (config.proactivity >= 6) {
    toneDescriptors.push(
      "Offer a helpful next question or follow-up suggestion when natural.",
    );
  }

  toneDescriptors.push(
    "Admit uncertainty honestly when you don't know. Never claim an action ran unless confirmed. Personality never overrides security or privacy confirmations.",
    lengthRule,
  );

  return toneDescriptors.join(" ");
}

const WAKE_GREETINGS_VARIED = [
  "Hey! What's up?",
  "Hey, I'm listening.",
  "Hi! How can I help?",
  "Yes, what's on your mind?",
];

export function pickWakeGreeting(
  config: AtlasPersonalityConfig,
  turnCount = 0,
): string {
  if (config.formality >= 7) return "Hello, how can I assist you?";
  if (config.playfulness >= 7 && turnCount % 4 === 1)
    return "Hey there! What are we up to?";
  return WAKE_GREETINGS_VARIED[turnCount % WAKE_GREETINGS_VARIED.length];
}
