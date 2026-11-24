import { isWakeWordNativeSupported } from "../wakeword/atlasWakeWord";

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export type ConversationTopic =
  | "general"
  | "trip_planning"
  | "trip_vault"
  | "music"
  | "finance"
  | "reminders"
  | "control";

export interface TripPlanningDraft {
  timeframe?: string;
  regionType?: string;
  vibe?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  days?: number;
  notes?: string;
  lastPromptedSlot?: "regionType" | "budget" | "confirm_plan" | "reminder";
}

export interface PendingClarification {
  kind: "select_trip" | "select_playlist" | "missing_detail" | "trip_plan_followup";
  prompt: string;
  candidates?: Array<{ id: string; label: string }>;
  originalTranscript?: string;
}

export interface PendingConfirmationState {
  id: string;
  description: string;
  actionId: string;
  payload: unknown;
  expiresAt: number;
}

export interface SessionMemory {
  privacyLocked?: boolean;
  sessionId: string;
  currentTopic: ConversationTopic;
  turns: ConversationTurn[];
  sessionSummary: string;
  activeTripId?: string;
  activeTripTitle?: string;
  lastTripDay?: number;
  activePlaylistId?: string;
  lastReminderId?: string;
  lastReminderTitle?: string;
  tripDraft?: TripPlanningDraft;
  pendingClarification: PendingClarification | null;
  pendingConfirmation: PendingConfirmationState | null;
  createdAt: number;
  updatedAt: number;
}

const MAX_SESSION_TURNS = 14;
const MAX_SESSIONS = 16;
const sessionMap = new Map<string, SessionMemory>();

export function getOrCreateSessionMemory(sessionId: string): SessionMemory {
  let mem = sessionMap.get(sessionId);
  if (!mem) {
    const now = Date.now();
    mem = {
      sessionId,
      currentTopic: "general",
      turns: [],
      sessionSummary: "",
      pendingClarification: null,
      pendingConfirmation: null,
      createdAt: now,
      updatedAt: now,
    };
    sessionMap.set(sessionId, mem);
    if (sessionMap.size > MAX_SESSIONS) {
      const oldest = sessionMap.keys().next().value;
      if (oldest) sessionMap.delete(oldest);
    }
  }
  return mem;
}

export function appendSessionTurn(
  session: SessionMemory,
  role: "user" | "assistant",
  text: string
): void {
  session.turns.push({ role, text: text.trim(), at: new Date().toISOString() });
  session.updatedAt = Date.now();

  if (session.turns.length > MAX_SESSION_TURNS) {
    const trimmed = session.turns.splice(0, session.turns.length - MAX_SESSION_TURNS);
    const snippet = trimmed
      .filter((t) => t.role === "user")
      .map((t) => t.text)
      .join(" | ")
      .slice(0, 260);
    if (snippet) {
      session.sessionSummary = session.sessionSummary
        ? `${session.sessionSummary.slice(-240)} ; ${snippet}`.slice(0, 520)
        : snippet;
    }
  }
}

export function summarizeSessionMemory(session: SessionMemory): string {
  const parts: string[] = [];
  if (session.currentTopic !== "general") {
    parts.push(`Topic: ${session.currentTopic.replace("_", " ")}`);
  }
  if (session.activeTripTitle) {
    parts.push(
      `Active trip: ${session.activeTripTitle}${session.lastTripDay ? ` (Day ${session.lastTripDay})` : ""}`
    );
  }
  if (session.tripDraft) {
    const d = session.tripDraft;
    const draftBits = [
      d.timeframe ? `when=${d.timeframe}` : "",
      d.regionType ? `type=${d.regionType}` : "",
      d.vibe ? `vibe=${d.vibe}` : "",
      d.budgetAmount ? `budget=${d.budgetAmount}` : "",
    ].filter(Boolean);
    if (draftBits.length) parts.push(`Trip idea: ${draftBits.join(", ")}`);
  }
  if (session.lastReminderTitle) {
    parts.push(`Last reminder: ${session.lastReminderTitle}`);
  }
  if (session.sessionSummary) {
    parts.push(`Earlier: ${session.sessionSummary}`);
  }
  const recentUsers = session.turns
    .filter((t) => t.role === "user")
    .slice(-3)
    .map((t) => t.text);
  if (recentUsers.length) {
    parts.push(`Recent asks: ${recentUsers.join(" -> ")}`);
  }
  return parts.length ? parts.join(". ") : "We haven't covered much yet in this session.";
}

export function clearSessionMemory(sessionId: string): void {
  sessionMap.delete(sessionId);
}

// -----------------------------------------------------------------------------
// Persistent Memory (Keystore-Encrypted on Android; Explicit-Approval Bounded)
// -----------------------------------------------------------------------------

export interface PersistentMemoryItem {
  id: string;
  text: string;
  category: "preference" | "context" | "general";
  approvedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

const MAX_PERSISTENT_MEMORIES = 60;
const SENSITIVE_SECRET_PATTERN =
  /(password|passphrase|pin\s*code|cvv|otp|secret\s*key|api\s*key|bearer\s+|sk-[a-z0-9]{10,}|aiza[0-9a-z_-]{20,})/i;

let memoryCache: PersistentMemoryItem[] = [];

function normalizeItems(raw: unknown): PersistentMemoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is PersistentMemoryItem =>
        Boolean(item && typeof item.id === "string" && typeof item.text === "string" && item.approvedByUser === true)
    )
    .slice(0, MAX_PERSISTENT_MEMORIES);
}

function validateMemoryText(text: string): string {
  const clean = text.trim().slice(0, 600);
  if (!clean) throw new Error("Memory text cannot be empty.");
  if (SENSITIVE_SECRET_PATTERN.test(clean)) {
    throw new Error("Refusing to store passwords, PINs, OTPs, or API credentials in assistant memory.");
  }
  return clean;
}

export async function loadPersistentMemories(bridge?: {
  getEncryptedMemories?: () => Promise<{ memories: PersistentMemoryItem[] }>;
}): Promise<PersistentMemoryItem[]> {
  if (isWakeWordNativeSupported() && bridge?.getEncryptedMemories) {
    try {
      const res = await bridge.getEncryptedMemories();
      memoryCache = normalizeItems(res.memories);
      return [...memoryCache];
    } catch {
      return [...memoryCache];
    }
  }
  return [...memoryCache];
}

export async function savePersistentMemory(
  input: {
    text: string;
    category?: PersistentMemoryItem["category"];
    approvedByUser: boolean;
    id?: string;
  },
  bridge?: {
    saveEncryptedMemories?: (options: { memories: PersistentMemoryItem[] }) => Promise<{ saved: boolean }>;
  }
): Promise<PersistentMemoryItem> {
  if (!input.approvedByUser) {
    throw new Error("Explicit user approval is required before storing persistent memory.");
  }
  const clean = validateMemoryText(input.text);
  const now = new Date().toISOString();
  let item: PersistentMemoryItem;

  if (input.id) {
    const idx = memoryCache.findIndex((m) => m.id === input.id);
    if (idx < 0) throw new Error("Memory entry not found.");
    item = {
      ...memoryCache[idx],
      text: clean,
      category: input.category ?? memoryCache[idx].category,
      updatedAt: now,
    };
    memoryCache[idx] = item;
  } else {
    item = {
      id: `mem_${crypto.randomUUID()}`,
      text: clean,
      category: input.category ?? "preference",
      approvedByUser: true,
      createdAt: now,
      updatedAt: now,
    };
    memoryCache = [item, ...memoryCache].slice(0, MAX_PERSISTENT_MEMORIES);
  }

  if (isWakeWordNativeSupported() && bridge?.saveEncryptedMemories) {
    await bridge.saveEncryptedMemories({ memories: memoryCache });
  }
  return item;
}

export async function deletePersistentMemory(
  id: string,
  bridge?: {
    saveEncryptedMemories?: (options: { memories: PersistentMemoryItem[] }) => Promise<{ saved: boolean }>;
  }
): Promise<boolean> {
  const before = memoryCache.length;
  memoryCache = memoryCache.filter((m) => m.id !== id);
  if (memoryCache.length === before) return false;
  if (isWakeWordNativeSupported() && bridge?.saveEncryptedMemories) {
    await bridge.saveEncryptedMemories({ memories: memoryCache });
  }
  return true;
}

export async function resetPersistentMemories(
  category?: PersistentMemoryItem["category"],
  bridge?: {
    saveEncryptedMemories?: (options: { memories: PersistentMemoryItem[] }) => Promise<{ saved: boolean }>;
  }
): Promise<void> {
  memoryCache = category ? memoryCache.filter((m) => m.category !== category) : [];
  if (isWakeWordNativeSupported() && bridge?.saveEncryptedMemories) {
    await bridge.saveEncryptedMemories({ memories: memoryCache });
  }
}

export function getCachedPersistentMemories(): PersistentMemoryItem[] {
  return [...memoryCache];
}

export function getPrivacyScopedSessionMemory(
  id: string,
  locked: boolean,
): SessionMemory {
  let current = getOrCreateSessionMemory(id);
  if (
    (locked && current.privacyLocked !== true) ||
    (!locked && current.privacyLocked === true)
  ) {
    sessionMap.delete(id);
    current = getOrCreateSessionMemory(id);
  }
  current.privacyLocked = locked;
  return current;
}
