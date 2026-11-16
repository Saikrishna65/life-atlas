import { createLocalAdapters, type LocalPlayback } from "./local-adapters";
import { parseAction, type AtlasAction } from "./gateway";
import { generateLocal, runtimeStatus } from "./native";

export interface VoiceTurn {
  role: "user" | "assistant";
  text: string;
}

export interface VoiceAssistantSessionContext {
  sessionId: string;
  turns: VoiceTurn[];
  activeTripId?: string;
  activeTripTitle?: string;
}

export interface VoiceAssistantReply {
  replyText: string;
  endSession: boolean;
  actionExecuted?: string;
}

const CLOUD_CONSENT_KEY = "atlas_voice_cloud_consent_v1";
const sessions = new Map<string, VoiceAssistantSessionContext>();

export function getVoiceCloudConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CLOUD_CONSENT_KEY) === "true";
}

export function setVoiceCloudConsent(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLOUD_CONSENT_KEY, enabled ? "true" : "false");
}

function getOrCreateSession(sessionId: string): VoiceAssistantSessionContext {
  let ctx = sessions.get(sessionId);
  if (!ctx) {
    ctx = { sessionId, turns: [] };
    sessions.set(sessionId, ctx);
    if (sessions.size > 12) {
      const oldestKey = sessions.keys().next().value;
      if (oldestKey) sessions.delete(oldestKey);
    }
  }
  return ctx;
}

function pushTurn(ctx: VoiceAssistantSessionContext, role: "user" | "assistant", text: string) {
  ctx.turns.push({ role, text });
  if (ctx.turns.length > 16) {
    ctx.turns.splice(0, ctx.turns.length - 16);
  }
}

function isSensitivePrivateQuery(lower: string): boolean {
  return (
    lower.includes("finance") ||
    lower.includes("balance") ||
    lower.includes("bank") ||
    lower.includes("expense") ||
    lower.includes("transaction") ||
    lower.includes("money") ||
    lower.includes("spent") ||
    lower.includes("memory") ||
    lower.includes("memories") ||
    lower.includes("vault") ||
    lower.includes("trip") ||
    lower.includes("itinerary") ||
    lower.includes("password") ||
    lower.includes("secret")
  );
}

function isExplicitEndCommand(lower: string): boolean {
  const exact = new Set([
    "stop",
    "cancel",
    "that's all",
    "thats all",
    "that is all",
    "go to sleep",
    "never mind",
    "nevermind",
    "bye",
    "bye atlas",
    "goodbye",
    "exit",
    "nothing",
  ]);
  return exact.has(lower) || lower.startsWith("stop listening");
}

function parseDayNumber(lower: string): number | null {
  const numeric = lower.match(/\bday\s*(\d{1,2})\b/);
  if (numeric) return Number(numeric[1]);
  const ordinals: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
  };
  for (const [word, num] of Object.entries(ordinals)) {
    if (lower.includes(`${word} day`) || lower.includes(`day ${word}`)) {
      return num;
    }
  }
  return null;
}

export async function processVoiceTurn(options: {
  sessionId: string;
  transcript: string;
  isLocked: boolean;
  player: () => LocalPlayback;
  navigate: (href: string) => void;
}): Promise<VoiceAssistantReply> {
  const { sessionId, transcript, isLocked, player, navigate } = options;
  const ctx = getOrCreateSession(sessionId);
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  pushTurn(ctx, "user", raw);

  const finish = (replyText: string, endSession = false, actionExecuted?: string): VoiceAssistantReply => {
    pushTurn(ctx, "assistant", replyText);
    return { replyText, endSession, actionExecuted };
  };

  if (!raw) {
    return finish("I didn't catch that. What would you like to do?", false);
  }

  if (isExplicitEndCommand(lower)) {
    return finish("Okay, going back to sleep.", true, "session.end");
  }

  // Lock-screen privacy guard
  if (isLocked && isSensitivePrivateQuery(lower)) {
    return finish(
      "Your phone is locked, so I won't access private Life Atlas vault, trip, or finance data. Unlock your phone and ask again.",
      true,
      "privacy.locked_guard"
    );
  }

  // Sensitive mutation guard (requires explicit confirmation in unlocked UI)
  if (
    lower.includes("delete ") ||
    lower.includes("remove ") ||
    lower.includes("add expense") ||
    lower.includes("record expense") ||
    lower.includes("share ") ||
    lower.includes("publish ") ||
    lower.includes("change password") ||
    lower.includes("security settings")
  ) {
    return finish(
      "That's a sensitive action. Please open Life Atlas while unlocked so you can review and confirm it directly.",
      false,
      "action.confirmation_required"
    );
  }

  const adapter = createLocalAdapters(player, navigate);
  const noopGuard = () => {};
  const runTypedAction = async (action: AtlasAction) => {
    const validated = parseAction(action);
    return adapter.execute(validated, noopGuard);
  };

  // Greetings
  if (
    lower === "hey atlas" ||
    lower === "atlas" ||
    lower === "hi" ||
    lower === "hello" ||
    lower === "hi atlas" ||
    lower === "hey" ||
    lower.includes("what's up")
  ) {
    return finish("Hey! What's up?", false);
  }

  // Time & Date
  if (lower.includes("what time") || lower === "time") {
    const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return finish(`It's ${now}.`, false);
  }
  if (lower.includes("what date") || lower.includes("today's date") || lower.includes("what day is it")) {
    const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    return finish(`Today is ${today}.`, false);
  }

  // Capabilities
  if (lower.includes("what can you do") || lower.includes("help")) {
    return finish(
      "I can open your Music or Trip Vault, control downloaded music playback, read your trip itinerary when unlocked, and save local reminders.",
      false
    );
  }

  // Safe Navigation
  if (lower.includes("open music") || lower.includes("music vault")) {
    if (isLocked) return finish("Unlock your phone first so I can open Music Vault.", true);
    await runTypedAction({ kind: "navigate", section: "music" });
    return finish("Opening Music Vault.", false, "navigate:music");
  }
  if (lower.includes("open trip") || lower.includes("trip vault")) {
    if (isLocked) return finish("Unlock your phone first so I can open Trip Vault.", true);
    await runTypedAction({ kind: "navigate", section: "trips" });
    return finish("Opening Trip Vault.", false, "navigate:trips");
  }
  if (lower.includes("open finance") || lower.includes("finance vault")) {
    if (isLocked) return finish("Unlock your phone first to view Finance Vault.", true);
    await runTypedAction({ kind: "navigate", section: "finance" });
    return finish("Opening Finance Vault.", false, "navigate:finance");
  }
  if (lower.includes("open home") || lower.includes("go home")) {
    await runTypedAction({ kind: "navigate", section: "home" });
    return finish("Heading to your Life Atlas home.", false, "navigate:home");
  }

  // Safe Music Playback Controls
  if (lower.includes("pause music") || lower === "pause") {
    await runTypedAction({ kind: "music.pause" });
    return finish("Paused your music.", false, "music.pause");
  }
  if (lower.includes("resume music") || lower === "resume") {
    try {
      await runTypedAction({ kind: "music.resume" });
      return finish("Resuming your track.", false, "music.resume");
    } catch (e) {
      return finish(e instanceof Error ? e.message : "No downloaded track is ready to resume.", false);
    }
  }
  if (lower.includes("next track") || lower.includes("next song") || lower === "skip") {
    try {
      await runTypedAction({ kind: "music.next" });
      return finish("Skipping to the next downloaded track.", false, "music.next");
    } catch (e) {
      return finish(e instanceof Error ? e.message : "No next downloaded track in the queue.", false);
    }
  }
  if (lower.startsWith("play ")) {
    const query = raw.slice(5).trim();
    if (query) {
      try {
        const matches = (await runTypedAction({ kind: "music.search", query })) as Array<{
          id: string;
          title: string;
          artist: string;
          downloaded: boolean;
        }>;
        const playable = matches.find((m) => m.downloaded);
        if (playable) {
          await runTypedAction({ kind: "music.play", id: playable.id });
          return finish(`Playing ${playable.title}${playable.artist ? ` by ${playable.artist}` : ""}.`, false, "music.play");
        }
        if (matches.length > 0) {
          return finish(`I found ${matches[0].title}, but it isn't downloaded offline on this device yet.`, false);
        }
        return finish(`I couldn't find "${query}" in your Music Vault.`, false);
      } catch (e) {
        return finish(e instanceof Error ? e.message : "Could not play that track right now.", false);
      }
    }
  }

  // Reminders (local-first)
  if (lower.startsWith("remind me to ") || lower.startsWith("create a reminder to ") || lower.startsWith("add reminder ")) {
    const title = raw
      .replace(/^remind me to\s+/i, "")
      .replace(/^create a reminder to\s+/i, "")
      .replace(/^add reminder\s+/i, "")
      .trim();
    if (title) {
      await runTypedAction({ kind: "reminder.create", title });
      return finish(`Got it. I saved a reminder: ${title}.`, false, "reminder.create");
    }
  }
  if (lower.includes("my reminders") || lower.includes("list reminders") || lower.includes("what reminders")) {
    const res = (await runTypedAction({ kind: "reminder.list" })) as {
      reminders: Array<{ title: string; dueText?: string }>;
    };
    if (!res.reminders.length) {
      return finish("You don't have any active reminders right now.", false, "reminder.list");
    }
    const top = res.reminders
      .slice(0, 3)
      .map((r) => r.title)
      .join(", ");
    return finish(
      `You have ${res.reminders.length} reminder${res.reminders.length === 1 ? "" : "s"}: ${top}.`,
      false,
      "reminder.list"
    );
  }

  // Trip Plan & Multi-Turn Follow-Up (Unlocked only)
  const dayRequest = parseDayNumber(lower);
  if (
    !isLocked &&
    (lower.includes("trip plan") ||
      lower.includes("my trip") ||
      lower.includes("itinerary") ||
      (dayRequest !== null && ctx.activeTripId))
  ) {
    try {
      let tripId = ctx.activeTripId;
      let tripTitle = ctx.activeTripTitle;
      if (!tripId) {
        const { getAllTrips } = await import("../vault/storage");
        const trips = await getAllTrips();
        if (!trips.length) {
          return finish("I couldn't find any trips in your Trip Vault.", false);
        }
        tripId = trips[0].id;
        tripTitle = trips[0].title;
      }
      const days = (await runTypedAction({ kind: "trips.itinerary", id: tripId })) as Array<{
        day: number;
        title: string;
        activities: Array<{ title?: string }>;
      }>;
      ctx.activeTripId = tripId;
      ctx.activeTripTitle = tripTitle;

      if (!days.length) {
        return finish(`${tripTitle ?? "Your trip"} doesn't have itinerary days added yet.`, false, "trips.itinerary");
      }

      const targetDayNum = dayRequest ?? 1;
      const target = days.find((d) => d.day === targetDayNum) ?? days[0];
      const actSummary = (target.activities ?? [])
        .slice(0, 3)
        .map((a) => a.title)
        .filter(Boolean)
        .join(", ");
      const base = `On day ${target.day} of ${tripTitle ?? "your trip"}, ${target.title}`;
      return finish(
        actSummary ? `${base}: ${actSummary}.` : `${base}.`,
        false,
        "trips.itinerary"
      );
    } catch (e) {
      return finish(e instanceof Error ? e.message : "Could not read your trip itinerary right now.", false);
    }
  }

  // Local LLM runtime check
  const rt = await runtimeStatus().catch(() => ({ available: false, reason: "Local AI runtime unavailable.", engine: "none" }));
  if (rt.available) {
    try {
      const historyText = ctx.turns
        .slice(-6)
        .map((t) => `${t.role === "user" ? "User" : "Atlas"}: ${t.text}`)
        .join("\n");
      const prompt =
        "You are Atlas, a friendly, warm, concise voice assistant. Answer naturally in 1-3 short spoken sentences.\n" +
        historyText +
        "\nAtlas:";
      const abort = new AbortController();
      let generated = "";
      await generateLocal(prompt, abort.signal, (tok) => {
        if (generated.length < 1000) generated += tok;
      });
      if (generated.trim()) {
        return finish(generated.trim(), false, "llm.local");
      }
    } catch {
      // Fall through to honest offline / cloud-consent check
    }
  }

  // Optional Cloud AI fallback (only with explicit user consent + online)
  if (getVoiceCloudConsent() && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await fetch("/api/atlas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: raw,
          history: ctx.turns.slice(-6),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reply?: string };
        if (data.reply?.trim()) {
          return finish(data.reply.trim(), false, "llm.cloud");
        }
      }
    } catch {
      // Fall through to honest offline fallback
    }
  }

  // Honest offline fallback (never fabricate AI responses)
  return finish(
    "I'm running offline without a local language model loaded right now. I can still open vaults, play downloaded music, check your unlocked trip plan, or save reminders.",
    false,
    "fallback.offline"
  );
}
