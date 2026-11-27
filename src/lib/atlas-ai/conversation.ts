import { executeRegisteredAction } from "./action-registry";
import { resolveNativeUtility } from "./native-utilities";
import type { AtlasSection, LocalAdapter } from "./gateway";
import {
  appendSessionTurn,
  getOrCreateSessionMemory,
  savePersistentMemory,
  summarizeSessionMemory,
  type PersistentMemoryItem,
  type SessionMemory,
} from "./memory";
import { loadPersonalityConfig, pickWakeGreeting, type AtlasPersonalityConfig } from "./personality";
import { executeOpenTripAndPackReminderWorkflow } from "./planner";
import { containsSensitiveVaultQuery, isSeriousSituation } from "./policy";
import {
  getWebCloudConsent,
  getWebCloudProvider,
  routeGenerativeReply,
} from "./providers";
import { findReminderByQuery, parseNaturalDueDate } from "./reminders";

export interface ConversationTurnInput {
  sessionId: string;
  transcript: string;
  isLocked: boolean;
  adapter: LocalAdapter;
  personality?: AtlasPersonalityConfig;
  allowCloud?: boolean;
  memories?: PersistentMemoryItem[];
  memoryBridge?: {
    saveEncryptedMemories?: (options: { memories: PersistentMemoryItem[] }) => Promise<{ saved: boolean }>;
  };
}

export interface ConversationTurnOutput {
  replyText: string;
  endSession: boolean;
  actionExecuted: string;
  requiresConfirmation?: boolean;
  confirmationDescription?: string;
}

const END_SESSION_EXACT = new Set([
  "stop",
  "stop listening",
  "cancel",
  "never mind",
  "nevermind",
  "nothing",
  "bye",
  "goodbye",
  "bye atlas",
  "goodbye atlas",
  "that is all",
  "that's all",
  "done",
  "go to sleep",
]);

function isExplicitEndCommand(lower: string): boolean {
  if (END_SESSION_EXACT.has(lower)) return true;
  return /^(stop|cancel|never mind|goodbye|bye|go to sleep)\b/.test(lower) && lower.split(/\s+/).length <= 4;
}

function parseDayOrdinal(lower: string): number | null {
  const numMatch = lower.match(/\bday\s+(\d{1,2})\b/);
  if (numMatch) return Number(numMatch[1]);
  const words: Record<string, number> = {
    first: 1, "1st": 1, one: 1,
    second: 2, "2nd": 2, two: 2,
    third: 3, "3rd": 3, three: 3,
    fourth: 4, "4th": 4, four: 4,
    fifth: 5, "5th": 5, five: 5,
    sixth: 6, "6th": 6, six: 6,
    seventh: 7, "7th": 7, seven: 7,
  };
  for (const [word, idx] of Object.entries(words)) {
    if (new RegExp(`\\b(?:${word})\\s+day\\b`).test(lower)) return idx;
  }
  return null;
}

function parseListSelectionIndex(lower: string): number | null {
  if (/\b(first|1st|one)\b/.test(lower)) return 0;
  if (/\b(second|2nd|two)\b/.test(lower)) return 1;
  if (/\b(third|3rd|three)\b/.test(lower)) return 2;
  if (/\b(fourth|4th|four)\b/.test(lower)) return 3;
  return null;
}

function extractBudgetAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").toLowerCase();
  const kMatch = cleaned.match(/\b(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);
  const numMatch = cleaned.match(/\b(\d{3,7})\b/);
  if (numMatch) return Number(numMatch[1]);
  const wordMap: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    fifteen: 15, twenty: 20,
  };
  const thousandMatch = cleaned.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+thousand\b/);
  if (thousandMatch && wordMap[thousandMatch[1]]) {
    return wordMap[thousandMatch[1]] * 1000;
  }
  return null;
}

function styleReply(text: string, serious: boolean, personality: AtlasPersonalityConfig): string {
  if (serious) return text;
  if (personality.responseLength === "brief" && text.length > 170) {
    const firstSentence = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    return firstSentence || text;
  }
  return text;
}

function isAffirmative(lower: string): boolean {
  return /^(yes|yeah|yep|yup|sure|ok|okay|do it|confirm|go ahead|please do|sounds good|yes please)\b/.test(lower);
}

function isNegative(lower: string): boolean {
  return /^(no|nope|nah|cancel|don't|do not|stop that|never mind)\b/.test(lower);
}

export async function runConversationTurn(input: ConversationTurnInput): Promise<ConversationTurnOutput> {
  const session: SessionMemory = getOrCreateSessionMemory(input.sessionId);
  const personality = input.personality ?? loadPersonalityConfig();
  const raw = input.transcript.trim();
  const lower = raw.toLowerCase();
  const serious = isSeriousSituation(raw);

  const finish = (
    replyText: string,
    endSession: boolean,
    actionExecuted: string,
    extra?: Partial<ConversationTurnOutput>
  ): ConversationTurnOutput => {
    const styled = styleReply(replyText, serious, personality);
    appendSessionTurn(session, "assistant", styled);
    return {
      replyText: styled,
      endSession,
      actionExecuted,
      ...extra,
    };
  };

  if (!raw) {
    return {
      replyText: pickWakeGreeting(personality, session.turns.length),
      endSession: false,
      actionExecuted: "prompt.empty",
    };
  }

  appendSessionTurn(session, "user", raw);

  // 1. Explicit end-of-conversation
  if (isExplicitEndCommand(lower) && !session.pendingConfirmation) {
    session.pendingClarification = null;
    return finish("Okay, going quiet whenever you need me.", true, "session.end");
  }

  // 2. Pending confirmation resolution
  if (session.pendingConfirmation) {
    const pending = session.pendingConfirmation;
    if (Date.now() > pending.expiresAt) {
      session.pendingConfirmation = null;
    } else if (isAffirmative(lower)) {
      session.pendingConfirmation = null;
      const res = await executeRegisteredAction({
        sessionId: session.sessionId,
        rawAction: pending.payload,
        adapter: input.adapter,
        isLocked: input.isLocked,
        explicitlyConfirmed: true,
      });
      if (res.ok) {
        return finish(`Done — I completed ${pending.description}.`, false, pending.actionId);
      }
      return finish(res.error ?? "Couldn't complete that confirmed action.", false, "action.failed");
    } else if (isNegative(lower)) {
      session.pendingConfirmation = null;
      return finish("Got it, canceled that change.", false, "action.canceled");
    } else if (!/^\s*(what|why|how)\b/i.test(lower)) {
      // User moved to a different request; clear stale confirmation
      session.pendingConfirmation = null;
    }
  }

  // 3. Pending clarification resolution (e.g., multiple trips matched earlier)
  if (session.pendingClarification) {
    const clar = session.pendingClarification;
    if (clar.kind === "select_trip" && clar.candidates?.length) {
      const byIdx = parseListSelectionIndex(lower);
      const matched =
        (byIdx !== null ? clar.candidates[byIdx] : undefined) ??
        clar.candidates.find((c) => lower.includes(c.label.toLowerCase()));
      if (matched) {
        session.pendingClarification = null;
        session.activeTripId = matched.id;
        session.activeTripTitle = matched.label;
        session.currentTopic = "trip_vault";
        if (clar.originalTranscript && /\bremind\b/i.test(clar.originalTranscript)) {
          return await handleTripWorkflowResult(
            await executeOpenTripAndPackReminderWorkflow({
              session,
              adapter: input.adapter,
              transcript: `${matched.label} ${clar.originalTranscript}`,
              isLocked: input.isLocked,
            }),
            finish
          );
        }
        const openRes = await executeRegisteredAction({
          sessionId: session.sessionId,
          rawAction: { kind: "trips.open", id: matched.id },
          adapter: input.adapter,
          isLocked: input.isLocked,
        });
        if (openRes.ok) {
          return finish(`Opening ${matched.label} now.`, true, "trips.open");
        }
        return finish(openRes.error ?? "Couldn't open that trip.", false, "trips.open");
      }
    }
  }

  // 4. Hard lock-screen privacy barrier
  if (input.isLocked && containsSensitiveVaultQuery(raw)) {
    return finish(
      "Your phone is locked right now. Unlock your screen so I can safely access your private Finance, Trip, or Memory Vault.",
      true,
      "privacy.locked_guard"
    );
  }

  // 5. Explicit destructive / sensitive mutation guard before executing
  const isSensitiveDeleteOrExpense =
    /\b(delete|remove|erase|wipe|transfer|send money|add expense|log expense|categorize)\b/i.test(raw) &&
    !lower.includes("memory");
  if (isSensitiveDeleteOrExpense) {
    // Check if it targets a real reminder we can delete with confirmation
    if (/\b(delete|remove)\b.*\breminder\b/i.test(lower)) {
      const remQuery = lower.replace(/^.*\breminder\b\s*(?:to|for|about)?\s*/i, "").trim();
      const target = findReminderByQuery(remQuery);
      if (target) {
        session.pendingConfirmation = {
          id: `conf_${crypto.randomUUID()}`,
          description: `delete the reminder "${target.title}"`,
          actionId: "reminder.delete",
          payload: { kind: "reminder.delete", id: target.id },
          expiresAt: Date.now() + 90_000,
        };
        return finish(
          `That deletes your reminder "${target.title}". Should I go ahead and remove it? Say yes to confirm.`,
          false,
          "action.confirmation_required",
          { requiresConfirmation: true, confirmationDescription: session.pendingConfirmation.description }
        );
      }
    }
    return finish(
      "That action modifies saved Life Atlas vault records. Please review and confirm this change inside the Life Atlas app first.",
      false,
      "action.confirmation_required",
      { requiresConfirmation: true, confirmationDescription: raw }
    );
  }

  // 6. Session summary
  if (/\b(summarize|summary|what did we talk about|recap)\b/i.test(lower)) {
    return finish(summarizeSessionMemory(session), false, "conversation.summary");
  }

  // 7. Explicit persistent memory request (requires safe non-secret check + confirmation)
  const rememberMatch = raw.match(/^(?:atlas\s+)?(?:please\s+)?remember\s+(?:that\s+)?(.+)$/i);
  if (rememberMatch) {
    const content = rememberMatch[1].trim();
    try {
      await savePersistentMemory(
        { text: content, category: "preference", approvedByUser: true },
        input.memoryBridge
      );
      return finish(
        `Got it, I'll remember "${content}" in your encrypted Atlas preferences. You can edit or delete it anytime in Atlas Control.`,
        false,
        "memory.save"
      );
    } catch (err) {
      return finish(
        err instanceof Error ? err.message : "I couldn't save that memory.",
        false,
        "memory.rejected"
      );
    }
  }

  // 8. Conversational greetings / small talk
  if (/^(hi|hey|hello|heya|yo|good morning|good afternoon|good evening|how are you|what's up|whats up|who are you)\b/.test(lower)) {
    const reply = /\bwho are you\b/.test(lower)
      ? "I'm Atlas, your local-first companion inside Life Atlas. I can plan trips with you, manage reminders, control local music, and summarize your vaults privately."
      : lower.includes("how are you")
        ? personality.humor >= 50
          ? "Running smoothly and caffeinated on local silicon! What are we tackling today?"
          : "Doing well and ready to help. What's on your mind?"
        : pickWakeGreeting(personality, session.turns.length);
    return finish(reply, false, "conversation.greeting");
  }

  // 9. Time & Date offline
  if (/\b(what time is it|current time|time now|what's the time|what date is today|today's date|what day is it)\b/.test(lower)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    return finish(`It's ${timeStr} on ${dateStr}.`, false, "utility.datetime");
  }

  // 10. Bounded local arithmetic and calendar utilities
  const utility = resolveNativeUtility(raw);
  if (utility) return finish(utility.text, false, utility.kind);

  // 11. Control status
  if (/\b(wake word|control room|cloud ai|status|latency)\b/.test(lower) && /\b(status|check|open|show)\b/.test(lower)) {
    if (/\bopen\b/.test(lower)) {
      const nav = await executeRegisteredAction({
        sessionId: session.sessionId,
        rawAction: { kind: "navigate", section: lower.includes("atlas") ? "atlas" : "control" },
        adapter: input.adapter,
        isLocked: input.isLocked,
      });
      if (nav.ok) return finish("Opening that settings panel now.", true, "navigate:control");
    }
    const statusRes = await executeRegisteredAction<{ cloudConsent: boolean; cloudProvider: string }>({
      sessionId: session.sessionId,
      rawAction: { kind: "control.status" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (statusRes.ok && statusRes.result) {
      return finish(
        "Automatic Cloud AI is disabled. Review each optional online request in the unlocked Atlas page.",
        false,
        "control.status"
      );
    }
  }

  // 12. Multi-step Trip + Reminder workflow
  if (
    (/\b(open|show|check)\b.*\btrip\b/i.test(lower) && /\bremind\b/i.test(lower)) ||
    (session.currentTopic !== "trip_planning" && /\bpack\b.*\b(night before|day before)\b/i.test(lower))
  ) {
    return await handleTripWorkflowResult(
      await executeOpenTripAndPackReminderWorkflow({
        session,
        adapter: input.adapter,
        transcript: raw,
        isLocked: input.isLocked,
      }),
      finish
    );
  }

  // 13. Navigation requests
  if (/\b(open|go to|show|take me to|switch to)\b/.test(lower)) {
    let section: AtlasSection | null = null;
    if (lower.includes("music")) section = "music";
    else if (lower.includes("finance") || lower.includes("budget")) section = "finance";
    else if (lower.includes("trip vault") || lower.includes("my trips")) section = "trips";
    else if (lower.includes("control room")) section = "control";
    else if (lower.includes("atlas studio") || lower.includes("personality")) section = "atlas";
    else if (lower.includes("home") || lower.includes("dashboard")) section = "home";

    if (section) {
      const navRes = await executeRegisteredAction({
        sessionId: session.sessionId,
        rawAction: { kind: "navigate", section },
        adapter: input.adapter,
        isLocked: input.isLocked,
      });
      if (navRes.ok) {
        return finish(`Opening ${section} now.`, true, `navigate:${section}`);
      }
      return finish(navRes.error ?? `Couldn't open ${section}.`, false, "navigate.failed");
    }
  }

  // 14. Multi-turn Trip Planning Dialogue (slot filling, vibes, budget, follow-up reminder)
  const isNewTripIdea =
    /\b(going somewhere|plan a trip|weekend trip|getaway|vacation|thinking about going|travel somewhere)\b/i.test(lower);
  const isBudgetReply = session.currentTopic === "trip_planning" && extractBudgetAmount(raw) !== null;
  const isTripPlanningFollowup =
    session.currentTopic === "trip_planning" &&
    (/\b(mountain|hills|beach|coastal|forest|city|peaceful|quiet|adventure|cheap|not too expensive|budget|relax|calm|lake|countryside)\b/i.test(lower) ||
      isBudgetReply ||
      session.tripDraft?.lastPromptedSlot === "confirm_plan");

  if (isNewTripIdea || isTripPlanningFollowup) {
    session.currentTopic = "trip_planning";
    session.tripDraft = session.tripDraft ?? {};
    const draft = session.tripDraft;

    if (/\bthis weekend\b/i.test(lower)) draft.timeframe = "this weekend";
    else if (/\bnext week(end)?\b/i.test(lower)) draft.timeframe = "next weekend";
    if (/\b(mountain|hill|hills|kasol|manali|shimla)\b/i.test(lower)) draft.regionType = "mountains";
    else if (/\b(beach|coast|sea|goa|island)\b/i.test(lower)) draft.regionType = "beaches";
    else if (/\b(forest|lake|countryside|nature|cabin)\b/i.test(lower)) draft.regionType = "quiet nature";
    if (/\b(peaceful|quiet|calm|chill|relax)\b/i.test(lower)) draft.vibe = "peaceful";
    else if (/\b(adventure|trek|hike)\b/i.test(lower)) draft.vibe = "adventurous";

    const budget = extractBudgetAmount(raw);
    if (budget !== null) {
      const wasCorrection = Boolean(draft.budgetAmount) || /\b(actually|make that|instead)\b/i.test(lower);
      draft.budgetAmount = budget;
      if (draft.lastPromptedSlot === "budget" || wasCorrection || !draft.lastPromptedSlot) {
        draft.lastPromptedSlot = "confirm_plan";
        const settingLabel = draft.regionType ?? (draft.vibe === "peaceful" ? "a peaceful homestay or quiet hill/lake spot" : "a relaxing spot");
        const vibePrefix = wasCorrection ? `Updated that budget to ${budget.toLocaleString()}! ` : "";
        return finish(
          `${vibePrefix}With around ${budget.toLocaleString()} for ${draft.timeframe ?? "the weekend"}, staying local with ${settingLabel}, shared transit, and a cozy stay makes total sense. Want me to save a reminder or check your saved trips in Trip Vault?`,
          false,
          "conversation.trip_planning"
        );
      }
    }

    if (draft.lastPromptedSlot === "confirm_plan") {
      if (/\bremind\b/i.test(lower) || isAffirmative(lower)) {
        const remTitle = /\bpack\b/i.test(lower)
          ? `Pack for ${draft.timeframe ?? "weekend"} ${draft.regionType ?? "getaway"}`
          : `Finalize ${draft.timeframe ?? "weekend"} ${draft.regionType ?? "trip"} plan`;
        const dueText = /\bday before\b/i.test(lower) ? "day before" : /\bnight before\b/i.test(lower) ? "night before" : draft.timeframe ?? "tomorrow";
        const triggerAtIso = parseNaturalDueDate(dueText)?.triggerAtIso;
        const remRes = await executeRegisteredAction({
          sessionId: session.sessionId,
          rawAction: {
            kind: "reminder.create",
            title: remTitle,
            dueText,
            ...(triggerAtIso ? { triggerAtIso } : {}),
          },
          adapter: input.adapter,
          isLocked: input.isLocked,
        });
        if (remRes.ok) {
          session.lastReminderTitle = remTitle;
          draft.lastPromptedSlot = "reminder";
          return finish(
            `Saved your reminder: "${remTitle}" (${dueText}).`,
            false,
            "reminder.create"
          );
        }
      }
    }

    if (!draft.regionType && draft.vibe && !draft.budgetAmount) {
      draft.lastPromptedSlot = "budget";
      const teasing = personality.playfulness >= 60 ? "Easy on the wallet—I like your style. " : "Got it. ";
      return finish(`${teasing}What budget are we working with?`, false, "conversation.trip_planning");
    }

    if (!draft.regionType && !draft.vibe) {
      draft.lastPromptedSlot = "regionType";
      return finish(
        personality.playfulness >= 60
          ? "Ooh, another adventure? Mountains, beaches, or somewhere completely different?"
          : "Sounds fun! Are you thinking mountains, beaches, or somewhere else?",
        false,
        "conversation.trip_planning"
      );
    }

    if (!draft.budgetAmount) {
      draft.lastPromptedSlot = "budget";
      return finish(
        `Love a ${draft.vibe ?? "good"} ${draft.regionType ?? "getaway"} vibe. What budget are you aiming for?`,
        false,
        "conversation.trip_planning"
      );
    }
  }

  // 15. Reminders (Create, List, Complete, Follow-up "add a reminder for that")
  if (/\b(my reminders|list reminders|show reminders|what reminders)\b/.test(lower)) {
    const res = await executeRegisteredAction<{ reminders: Array<{ title: string; dueText?: string }> }>({
      sessionId: session.sessionId,
      rawAction: { kind: "reminder.list" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (res.ok && res.result) {
      if (!res.result.reminders.length) {
        return finish("You don't have any active reminders right now.", false, "reminder.list");
      }
      const summary = res.result.reminders
        .slice(0, 4)
        .map((r) => (r.dueText ? `${r.title} (${r.dueText})` : r.title))
        .join("; ");
      return finish(`Here's what's on your list: ${summary}.`, false, "reminder.list");
    }
  }

  if (/\b(complete|finish|mark done|check off)\b.*\breminder\b/.test(lower) && session.lastReminderId) {
    const res = await executeRegisteredAction({
      sessionId: session.sessionId,
      rawAction: { kind: "reminder.complete", id: session.lastReminderId },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (res.ok) return finish(`Marked "${session.lastReminderTitle ?? "that reminder"}" as completed.`, false, "reminder.complete");
  }

  if (/\bremind me\b/.test(lower) || /^add (?:a )?reminder\b/.test(lower)) {
    const isContextRef = /\b(for that|for it|for this|that day)\b/.test(lower);
    let title = raw
      .replace(/^.*?(?:remind me(?: to)?|add (?:a )?reminder(?: to| for)?)\s+/i, "")
      .replace(/\s+(?:for that|for it|for this)$/i, "")
      .trim();

    if ((!title || isContextRef) && session.activeTripTitle) {
      title = session.lastTripDay
        ? `${session.activeTripTitle} - Day ${session.lastTripDay}`
        : session.activeTripTitle;
    }
    if (!title) {
      return finish("Sure—what would you like me to remind you about?", false, "clarification.reminder");
    }
    const dueMatch = title.match(/\s+(tomorrow|tonight|this evening|next week|night before|day before|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i);
    const dueText = dueMatch?.[1];
    const cleanTitle = dueMatch ? title.slice(0, dueMatch.index).trim() || title : title;
    const triggerAtIso = parseNaturalDueDate(dueText)?.triggerAtIso;

    const res = await executeRegisteredAction<{ reminder: { id: string; title: string } }>({
      sessionId: session.sessionId,
      rawAction: {
        kind: "reminder.create",
        title: cleanTitle,
        ...(dueText ? { dueText } : {}),
        ...(session.activeTripId ? { tripId: session.activeTripId } : {}),
        ...(triggerAtIso ? { triggerAtIso } : {}),
      },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (res.ok && res.result) {
      session.lastReminderId = res.result.reminder.id;
      session.lastReminderTitle = res.result.reminder.title;
      return finish(
        `Got it, I'll remind you to ${cleanTitle}${dueText ? ` (${dueText})` : ""}.`,
        false,
        "reminder.create"
      );
    }
    return finish(res.error ?? "Couldn't save that reminder.", false, "reminder.failed");
  }

  // 16. Music Vault Controls & Search
  if (/\b(pause|stop playing|stop music|pause music|pause it)\b/.test(lower)) {
    const res = await executeRegisteredAction({
      sessionId: session.sessionId,
      rawAction: { kind: "music.pause" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    return finish(res.ok ? "Paused your music." : res.error ?? "Couldn't pause playback.", false, "music.pause");
  }
  if (/\b(resume music|resume playing|continue music|play again|unpause)\b/.test(lower)) {
    const res = await executeRegisteredAction({
      sessionId: session.sessionId,
      rawAction: { kind: "music.resume" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    return finish(res.ok ? "Resuming your music." : res.error ?? "Couldn't resume playback right now.", false, "music.resume");
  }
  if (/\b(next song|next track|skip track|skip song)\b/.test(lower)) {
    const res = await executeRegisteredAction<{ title?: string }>({
      sessionId: session.sessionId,
      rawAction: { kind: "music.next" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    return finish(res.ok ? `Skipped to ${res.result?.title ?? "the next track"}.` : res.error ?? "Couldn't skip track.", false, "music.next");
  }
  if (/\b(previous song|previous track|last song|go back track)\b/.test(lower)) {
    const res = await executeRegisteredAction<{ title?: string | null }>({
      sessionId: session.sessionId,
      rawAction: { kind: "music.previous" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    return finish(res.ok ? `Back to ${res.result?.title ?? "the previous track"}.` : res.error ?? "Couldn't go back a track.", false, "music.previous");
  }
  if (/\b(what is playing|what's playing|current song|current track|which song)\b/.test(lower)) {
    const res = await executeRegisteredAction<{ track: { title: string; artist?: string } | null; playing: boolean }>({
      sessionId: session.sessionId,
      rawAction: { kind: "music.state" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (res.ok && res.result) {
      return finish(
        res.result.track
          ? `${res.result.playing ? "Playing" : "Paused on"} "${res.result.track.title}"${res.result.track.artist ? ` by ${res.result.track.artist}` : ""}.`
          : "Nothing is playing right now.",
        false,
        "music.state"
      );
    }
  }
  if (/\b(shuffle)\b/.test(lower)) {
    const res = await executeRegisteredAction({
      sessionId: session.sessionId,
      rawAction: { kind: "music.toggleShuffle" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    return finish(res.ok ? "Toggled shuffle mode." : res.error ?? "Shuffle isn't available right now.", false, "music.toggleShuffle");
  }
  if (/\b(repeat mode|cycle repeat|loop song)\b/.test(lower)) {
    const res = await executeRegisteredAction({
      sessionId: session.sessionId,
      rawAction: { kind: "music.cycleRepeat" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    return finish(res.ok ? "Updated repeat mode." : res.error ?? "Repeat mode isn't available right now.", false, "music.cycleRepeat");
  }
  const speedMatch = lower.match(/\b(?:playback\s*speed|speed)\s*(?:to\s*)?(\d(?:\.\d+)?)\s*x?\b/);
  if (speedMatch) {
    const rate = Number(speedMatch[1]);
    const res = await executeRegisteredAction({
      sessionId: session.sessionId,
      rawAction: { kind: "music.setPlaybackRate", rate },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    return finish(res.ok ? `Playback speed set to ${rate}x.` : res.error ?? "Couldn't change playback speed.", false, "music.setPlaybackRate");
  }
  if (/\bplay\b/.test(lower)) {
    const query = raw.replace(/^.*?\bplay\b\s*(?:my|the|song|track|music)?\s*/i, "").trim();
    const searchRes = await executeRegisteredAction<Array<{ id: string; title: string; artist: string; downloaded: boolean }>>({
      sessionId: session.sessionId,
      rawAction: { kind: "music.search", query: query || " " },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (searchRes.ok && searchRes.result) {
      const playable = searchRes.result.find((t) => t.downloaded);
      if (playable) {
        const playRes = await executeRegisteredAction({
          sessionId: session.sessionId,
          rawAction: { kind: "music.play", id: playable.id },
          adapter: input.adapter,
          isLocked: input.isLocked,
        });
        if (playRes.ok) {
          session.currentTopic = "music";
          return finish(`Playing ${playable.title} by ${playable.artist}.`, false, "music.play");
        }
      }
      return finish(
        searchRes.result.length
          ? `Found "${searchRes.result[0].title}", but it isn't downloaded offline yet.`
          : query
            ? `I couldn't find "${query}" in your local Music Vault.`
            : "Your local Music Vault has no downloaded tracks yet.",
        false,
        "music.search"
      );
    }
  }

  // 17. Finance Vault (Summary, Category Breakdown, Expense Search, Budget Help)
  if (/\b(finance|balance|money|bank|expense|spent|spending|categories|budget)\b/.test(lower)) {
    session.currentTopic = "finance";
    if (/\b(budget|budgets|limit)\b/.test(lower)) {
      const bRes = await executeRegisteredAction<Array<{ categoryName: string; limitPaise: number; period: string }>>({
        sessionId: session.sessionId,
        rawAction: { kind: "finance.budgetHelp" },
        adapter: input.adapter,
        isLocked: input.isLocked,
      });
      if (bRes.ok && bRes.result) {
        if (!bRes.result.length) {
          return finish("You haven't configured category budgets in Finance Vault yet—I can open Finance Vault if you'd like to set one.", false, "finance.budgetHelp");
        }
        const top = bRes.result.slice(0, 3).map((b) => `${b.categoryName}: ${(b.limitPaise / 100).toFixed(0)} (${b.period})`).join(", ");
        return finish(`Your current budgets are ${top}. Want to focus on one category?`, false, "finance.budgetHelp");
      }
    }
    if (/\b(category|categories|break\s*down)\b/.test(lower)) {
      const catRes = await executeRegisteredAction<Array<{ name: string; type: string; totalPaise: number; count: number }>>({
        sessionId: session.sessionId,
        rawAction: { kind: "finance.explainCategories" },
        adapter: input.adapter,
        isLocked: input.isLocked,
      });
      if (catRes.ok && catRes.result) {
        const nonEmpty = catRes.result.filter((c) => c.count > 0 && c.type === "expense").sort((a, b) => b.totalPaise - a.totalPaise).slice(0, 3);
        if (!nonEmpty.length) {
          return finish("No posted category expenses found in your Finance Vault yet.", false, "finance.explainCategories");
        }
        const line = nonEmpty.map((c) => `${c.name} (${(c.totalPaise / 100).toFixed(0)} across ${c.count})`).join(", ");
        return finish(`Your biggest expense categories are ${line}.`, false, "finance.explainCategories");
      }
    }
    const sumRes = await executeRegisteredAction<{
      accounts: Array<{ name: string; currency: string; balances?: { availablePaise?: number } }>;
      transactions: Array<{ description: string; amountPaise: number }>;
    }>({
      sessionId: session.sessionId,
      rawAction: { kind: "finance.summary" },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (sumRes.ok && sumRes.result) {
      const accounts = sumRes.result.accounts ?? [];
      if (!accounts.length) return finish("You don't have any active accounts in Finance Vault yet.", false, "finance.summary");
      const line = accounts
        .slice(0, 3)
        .map((a) => `${a.name} (${a.currency} ${((a.balances?.availablePaise ?? 0) / 100).toFixed(0)})`)
        .join(", ");
      return finish(`You have ${accounts.length} active account${accounts.length > 1 ? "s" : ""}: ${line}.`, false, "finance.summary");
    }
    return finish(sumRes.error ?? "Couldn't read Finance Vault right now.", false, "finance.failed");
  }

  // 18. Trip Vault Queries, Day Follow-ups & Corrections
  const dayNum = parseDayOrdinal(lower);
  const isTripContextFollowup =
    (Boolean(session.activeTripId) && (dayNum !== null || /\b(actually|instead|day|itinerary|next day)\b/.test(lower))) ||
    /\b(trip|trips|itinerary|destination)\b/.test(lower);

  if (isTripContextFollowup) {
    session.currentTopic = "trip_vault";
    let tripId = session.activeTripId;
    let tripTitle = session.activeTripTitle;

    if (!tripId || /\b(open|list|all|my trips|upcoming|which)\b/.test(lower)) {
      const listRes = await executeRegisteredAction<Array<{ id: string; title: string; destination: string; startDate?: string }>>({
        sessionId: session.sessionId,
        rawAction: { kind: "trips.list" },
        adapter: input.adapter,
        isLocked: input.isLocked,
      });
      if (!listRes.ok) {
        return finish(listRes.error ?? "Couldn't check Trip Vault right now.", false, "trips.failed");
      }
      const trips = listRes.result ?? [];
      if (!trips.length) {
        return finish("You don't have any saved trips in Trip Vault yet.", false, "trips.list");
      }
      if (/\b(list|all my trips|what trips|show my trips)\b/.test(lower)) {
        const names = trips.slice(0, 4).map((t) => t.title).join(", ");
        return finish(`You have ${trips.length} trip${trips.length > 1 ? "s" : ""}: ${names}. Which one should I open?`, false, "trips.list");
      }

      const namedMatch = trips.find((t) => lower.includes(t.title.toLowerCase()) || lower.includes(t.destination.toLowerCase()));
      if (!namedMatch && trips.length > 1 && /\bopen my trip\b/.test(lower)) {
        const candidates = trips.slice(0, 3);
        session.pendingClarification = {
          kind: "select_trip",
          prompt: "Which trip should I open?",
          candidates: candidates.map((c) => ({ id: c.id, label: c.title })),
        };
        return finish(
          `You have ${candidates.map((c) => c.title).join(", ")}. Which trip do you want to open?`,
          false,
          "clarification.trip"
        );
      }

      const chosen = namedMatch ?? trips[0];
      tripId = chosen.id;
      tripTitle = chosen.title;
      session.activeTripId = tripId;
      session.activeTripTitle = tripTitle;

      if (/\bopen\b/.test(lower) && dayNum === null) {
        const openRes = await executeRegisteredAction({
          sessionId: session.sessionId,
          rawAction: { kind: "trips.open", id: tripId },
          adapter: input.adapter,
          isLocked: input.isLocked,
        });
        if (openRes.ok) return finish(`Opening ${tripTitle} now.`, true, "trips.open");
      }
    }

    const daysRes = await executeRegisteredAction<Array<{ day: number; title: string; activities: Array<{ title?: string }> }>>({
      sessionId: session.sessionId,
      rawAction: { kind: "trips.itinerary", id: tripId! },
      adapter: input.adapter,
      isLocked: input.isLocked,
    });
    if (!daysRes.ok) return finish(daysRes.error ?? "Couldn't read that itinerary.", false, "trips.itinerary");
    const days = daysRes.result ?? [];
    if (!days.length) {
      return finish(`${tripTitle ?? "Your trip"} doesn't have itinerary days added yet.`, false, "trips.itinerary");
    }
    const targetDay = dayNum ?? (/\bnext day\b/.test(lower) && session.lastTripDay ? session.lastTripDay + 1 : 1);
    const matchedDay = days.find((d) => d.day === targetDay);
    if (!matchedDay) {
      return finish(`${tripTitle ?? "That trip"} currently only has ${days.length} day${days.length > 1 ? "s" : ""}. Want me to read day ${days.length}?`, false, "trips.itinerary");
    }
    session.lastTripDay = matchedDay.day;
    const activities = (matchedDay.activities ?? []).slice(0, 3).map((a) => a.title).filter(Boolean).join(", ");
    const correctionAck = /\b(actually|instead)\b/.test(lower) ? "Got it, switching — " : "";
    return finish(
      activities
        ? `${correctionAck}on day ${matchedDay.day} of ${tripTitle}, ${matchedDay.title}: ${activities}.`
        : `${correctionAck}day ${matchedDay.day} of ${tripTitle} is ${matchedDay.title}.`,
      false,
      "trips.itinerary"
    );
  }

  // 19. Local model only; optional online questions require a separate approved request.
  const allowCloud = input.allowCloud ?? getWebCloudConsent();
  const providerReply = await routeGenerativeReply({
    userText: raw,
    session,
    personality,
    allowCloud,
    cloudProvider: getWebCloudProvider(),
  });
  if (providerReply) {
    return finish(providerReply.text, false, providerReply.source);
  }

  // 20. Honest, helpful offline fallback (never fabricates answers)
  return finish(
    "I can’t generate an open-ended local reply until a model is available. I can still help with local commands and quick math. For an online question, review the exact request in the unlocked Atlas page.",
    false,
    "fallback.offline"
  );
}

async function handleTripWorkflowResult(
  result: Awaited<ReturnType<typeof executeOpenTripAndPackReminderWorkflow>>,
  finish: (
    replyText: string,
    endSession: boolean,
    actionExecuted: string,
    extra?: Partial<ConversationTurnOutput>
  ) => ConversationTurnOutput
): Promise<ConversationTurnOutput> {
  return finish(result.replyText, result.endSession, result.actionExecuted, {
    requiresConfirmation: result.status === "confirmation_required",
  });
}
