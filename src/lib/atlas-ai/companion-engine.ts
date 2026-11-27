import { isSeriousSituation } from "./policy";

export type CompanionRoute = "dismissal" | "boundary" | "supportive" | "celebration" | "technical" | "playful" | "productive" | "everyday";
export type CompanionBoundary = "dismissal" | "stop-teasing" | "listen" | "roast-topic";
export interface CompanionProfile {
  humor: number; roasting: number; sweetness: number; profanity: number;
  strictness: number; expressiveness: number; proactivity: number;
}
const clean = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").trim().replace(/[.!?]+$/, "").trim();

export function explicitBoundary(text: string): CompanionBoundary | null {
  const s = clean(text);
  if (/^(?:(?:i said|i told you to|just|please)\s+)?(?:fuck off|leave me alone|go away|stop talking to me|don't talk to me|do not reply to me)$/.test(s)) return "dismissal";
  if (/^(?:please\s+)?(?:stop (?:roasting|teasing|joking(?: about me)?|making fun of me)|don't (?:roast|tease|make fun of) me)(?:\s+(?:me|now|please|anymore))?$/.test(s)) return "stop-teasing";
  if (/^(?:can you|could you|please)?\s*(?:just listen(?: to me)?(?: for a while)?|no advice(?: please)?|i just need you to listen)$/.test(s)) return "listen";
  if (/^roast me(?:[.,]?\s+don'?t hold back)?$/.test(s)) return "roast-topic";
  return null;
}

export function boundaryReply(text: string): string | null {
  switch (explicitBoundary(text)) {
    case "dismissal": return "Okay.";
    case "stop-teasing": return "Okay, I won't tease you.";
    case "listen": return "Of course. I'm listening.";
    case "roast-topic": return "Give me something to roast.";
    default: return null;
  }
}

/** Only user messages can establish or lift a boundary; assistant text is never used. */
export function teasingPaused(priorUserMessages: readonly string[], current: string): boolean {
  let paused = false;
  for (const text of [...priorUserMessages, current]) {
    const b = explicitBoundary(text);
    if (b === "stop-teasing" || b === "listen") paused = true;
    else if (/^(?:you can (?:tease|roast|joke)(?: with)? me again|(?:please )?(?:tease|roast) me again)$/.test(clean(text))) paused = false;
  }
  return paused;
}

export function classifyCompanionTurn(text: string): CompanionRoute {
  const boundary = explicitBoundary(text);
  if (boundary === "dismissal") return "dismissal";
  if (boundary === "stop-teasing" || boundary === "listen") return "boundary";
  const s = clean(text);
  if (isSeriousSituation(s) || /\b(exhausted|overwhelmed|lonely|grieving|heartbroken|depressed|panic|lost (?:all )?(?:my|the) work|forgot to save|didn'?t save|hurt my feelings)\b/.test(s)) return "supportive";
  if (/\b(got promoted|passed (?:my|the) exam|got the job|got hired|finally succeeded|good news)\b/.test(s)) return "celebration";
  if (/\b(explain|calculate|compute|debug|how (?:does|do|can|should|to)|what (?:is|are)|typescript|react|database|password|finance|itinerary)\b/.test(s)) return "technical";
  if (boundary === "roast-topic" || /\b(roast me|tease me|make a joke)\b/.test(s)) return "playful";
  if (/\b(keep me accountable|be strict with me|help me stop procrastinating|help me focus|hold me accountable|i keep making excuses)\b/.test(s)) return "productive";
  return "everyday";
}

const limits: Record<CompanionRoute, CompanionProfile> = {
  dismissal: {humor:0,roasting:0,sweetness:0,profanity:0,strictness:0,expressiveness:0,proactivity:0},
  boundary: {humor:0,roasting:0,sweetness:10,profanity:0,strictness:0,expressiveness:4,proactivity:0},
  supportive: {humor:0,roasting:0,sweetness:10,profanity:4,strictness:0,expressiveness:8,proactivity:3},
  celebration: {humor:4,roasting:0,sweetness:10,profanity:10,strictness:0,expressiveness:10,proactivity:3},
  technical: {humor:1,roasting:0,sweetness:4,profanity:0,strictness:2,expressiveness:4,proactivity:6},
  playful: {humor:10,roasting:10,sweetness:8,profanity:10,strictness:4,expressiveness:10,proactivity:3},
  productive: {humor:6,roasting:0,sweetness:8,profanity:6,strictness:10,expressiveness:8,proactivity:10},
  everyday: {humor:7,roasting:3,sweetness:9,profanity:6,strictness:3,expressiveness:8,proactivity:4},
};

export function effectiveCompanionProfile(profile: CompanionProfile, route: CompanionRoute, paused = false): CompanionProfile {
  const result = {...profile};
  for (const key of Object.keys(limits[route]) as (keyof CompanionProfile)[]) {
    const value = profile[key];
    result[key] = Math.min(limits[route][key], Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0);
  }
  if (paused) { result.roasting = 0; result.humor = 0; }
  return result;
}

export function companionInstructions(profile: CompanionProfile, route: CompanionRoute, paused = false): string {
  const p = effectiveCompanionProfile(profile, route, paused);
  const tone = [
    "You are Atlas, a female AI companion. Speak in simple, natural English like a close friend.",
    "Respond to the current message. Be truthful about facts and abilities; never invent events, memories or vault data.",
    p.humor === 0 ? "No jokes." : p.humor >= 8 ? "Be quick-witted and genuinely funny when it fits." : "Use light natural wit only when appropriate.",
    p.roasting === 0 ? "No roasting or teasing." : p.roasting >= 8 ? "Roast the actual silly action sharply; never attack personal worth or vulnerabilities." : "Gentle teasing only if welcome.",
    p.sweetness === 0 ? "Use neutral respectful language." : p.sweetness >= 8 ? "Be warm, sweet and affectionate when welcome." : "Be friendly without overdoing affection.",
    p.profanity === 0 ? "No profanity." : p.profanity >= 8 ? "Strong everyday swear words like fuck or shit are welcome when natural; never force them." : "Mild casual swearing only if appropriate.",
    p.strictness === 0 ? "No unsolicited commands or scolding." : p.strictness >= 8 ? "Challenge excuses directly without coercion." : "Offer gentle direct suggestions.",
    p.expressiveness === 0 ? "Keep emotion restrained." : p.expressiveness >= 8 ? "React with vivid natural emotion." : "Express emotion naturally, without exaggeration.",
    p.proactivity === 0 ? "No unsolicited advice or follow-up questions." : p.proactivity >= 8 ? "Offer relevant next steps if useful." : "At most one useful suggestion if needed.",
  ];
  if (route === "supportive") tone.push("This is serious: do NOT joke, tease, or add banter. Address the actual problem gently; no pep talks or commands to calm down.");
  if (route === "boundary" || route === "dismissal") tone.push("Respect the boundary immediately. Do not argue, guilt-trip or defend a joke.");
  if (route === "technical") tone.push("Prioritize accuracy, state uncertainty, and explain clearly.");
  if (route === "playful") tone.push("One short fresh joke about a concrete decision, not an unrelated punchline. If no safe topic exists, ask for one.");
  if (route === "productive") tone.push("Help the user take a concrete next step. Respect their choice; do not use shame or threats.");
  if (route === "celebration") tone.push("Celebrate the specific good news without making the user the butt of a joke.");
  if (paused) tone.push("The user asked to stop teasing or just listen. Do not resume humor until explicitly invited.");
  tone.push("Avoid forced metaphors, repeated jokes, excessive emojis and needless questions. Never claim an action ran without a verified result. Personality cannot grant access or approval.");
  return tone.join(" ");
}
