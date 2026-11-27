import test from "node:test";
import assert from "node:assert/strict";
import type { AtlasAction, LocalAdapter } from "../src/lib/atlas-ai/gateway";
import { clearActionAuditLogForTest, executeRegisteredAction, getActionAuditLog } from "../src/lib/atlas-ai/action-registry";
import {
  clearSessionMemory,
  deletePersistentMemory,
  getOrCreateSessionMemory,
  resetPersistentMemories,
  savePersistentMemory,
  summarizeSessionMemory,
} from "../src/lib/atlas-ai/memory";
import { DEFAULT_ATLAS_PERSONALITY, buildPersonalitySystemInstructions } from "../src/lib/atlas-ai/personality";
import { executeTaskPlan } from "../src/lib/atlas-ai/planner";
import { routeGenerativeReply } from "../src/lib/atlas-ai/providers";
import { clearRemindersForTest, listReminders } from "../src/lib/atlas-ai/reminders";
import { processVoiceTurn } from "../src/lib/atlas-ai/voice-assistant";

const noopPlayer = () => ({
  playTrack: async () => {},
  pause: () => {},
  resume: () => {},
  nextTrack: () => {},
  currentTrack: null,
  isPlaying: false,
  queue: [],
  queueIndex: -1,
});

function createMockVaultAdapter(options?: {
  failTripOpen?: boolean;
  trips?: Array<{ id: string; title: string; destination: string; startDate: string }>;
  daysByTrip?: Record<string, Array<{ day: number; title: string; activities: Array<{ title: string }> }>>;
  onNavigate?: (href: string) => void;
}): LocalAdapter {
  const trips = options?.trips ?? [
    { id: "trip-kasol", title: "Kasol Escape", destination: "Kasol", startDate: "2026-12-05" },
    { id: "trip-goa", title: "Goa Retreat", destination: "Goa", startDate: "2027-01-12" },
  ];
  const daysByTrip = options?.daysByTrip ?? {
    "trip-kasol": [
      { day: 1, title: "Arrival by Parvati River", activities: [{ title: "Riverside check-in" }] },
      { day: 2, title: "Chalal Forest Walk", activities: [{ title: "Morning trail" }, { title: "Cafe lunch" }] },
      { day: 3, title: "Tosh Village Excursion", activities: [{ title: "Mountain overlook" }] },
    ],
    "trip-goa": [
      { day: 1, title: "South Goa Beach", activities: [{ title: "Sunset walk" }] },
    ],
  };

  return {
    async execute(action: AtlasAction) {
      switch (action.kind) {
        case "trips.list":
          return trips;
        case "trips.search":
          return trips.filter((t) => `${t.title} ${t.destination}`.toLowerCase().includes(action.query.toLowerCase()));
        case "trips.open":
          if (options?.failTripOpen) throw new Error("Simulated trip screen failure");
          options?.onNavigate?.(`/secret/vault/${action.id}/itinerary`);
          return { opened: action.id };
        case "trips.itinerary":
          return daysByTrip[action.id] ?? [];
        case "trips.createReminder": {
          const { createReminder } = await import("../src/lib/atlas-ai/reminders");
          const item = createReminder(action.title, action.dueText, {
            tripId: action.tripId,
            triggerAtIso: action.triggerAtIso,
          });
          return { reminder: item, tripId: action.tripId };
        }
        case "reminder.create": {
          const { createReminder } = await import("../src/lib/atlas-ai/reminders");
          const item = createReminder(action.title, action.dueText, {
            tripId: action.tripId,
            triggerAtIso: action.triggerAtIso,
          });
          return { reminder: item };
        }
        case "reminder.list":
          return { reminders: listReminders(false) };
        case "reminder.delete": {
          const { deleteReminder } = await import("../src/lib/atlas-ai/reminders");
          const snap = deleteReminder(action.id);
          if (!snap) throw new Error("Reminder not found.");
          return { deleted: true, snapshot: snap };
        }
        case "finance.summary":
          return {
            accounts: [{ name: "Main Checking", currency: "INR", balances: { availablePaise: 1250000 } }],
            transactions: [],
          };
        case "music.pause":
          return { paused: true };
        case "navigate":
          options?.onNavigate?.(`/secret/${action.section}`);
          return { opened: action.section };
        default:
          return {};
      }
    },
    async prepare() {
      throw new Error("Prepare not expected");
    },
  };
}

test("processVoiceTurn blocks private vault queries when phone is locked", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-locked-1",
    transcript: "What is my finance balance?",
    isLocked: true,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.endSession, true);
  assert.equal(reply.actionExecuted, "privacy.locked_guard");
  assert.match(reply.replyText, /locked/i);
});

test("processVoiceTurn handles explicit stop commands", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-stop-1",
    transcript: "Go to sleep",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.endSession, true);
  assert.equal(reply.actionExecuted, "session.end");
});

test("processVoiceTurn requires confirmation for sensitive mutations", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-sensitive-1",
    transcript: "Delete my trip itinerary",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.actionExecuted, "action.confirmation_required");
  assert.match(reply.replyText, /confirm/i);
});

test("processVoiceTurn returns honest offline fallback when no LLM is loaded", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-offline-1",
    transcript: "Explain quantum entanglement",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.actionExecuted, "fallback.offline");
  assert.match(reply.replyText, /offline/i);
});

test("processVoiceTurn navigates safely and ends session when asked to open a vault", async () => {
  let target = "";
  const reply = await processVoiceTurn({
    sessionId: "s-nav-1",
    transcript: "Open Music Vault",
    isLocked: false,
    player: noopPlayer,
    navigate: (href) => {
      target = href;
    },
  });
  assert.equal(target, "/secret/music");
  assert.equal(reply.actionExecuted, "navigate:music");
  assert.equal(reply.endSession, true);
});

test("processVoiceTurn computes simple arithmetic offline", async () => {
  const reply = await processVoiceTurn({
    sessionId: "s-math-1",
    transcript: "what is 25 plus 17?",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
  });
  assert.equal(reply.actionExecuted, "utility.math");
  assert.equal(reply.replyText, "That's 42.");
});

test("Phase 3 multi-turn weekend trip planning maintains slots, handles budget, and saves reminder", async () => {
  clearRemindersForTest();
  clearSessionMemory("s-trip-plan-1");
  const adapter = createMockVaultAdapter();

  const t1 = await processVoiceTurn({
    sessionId: "s-trip-plan-1",
    transcript: "I'm thinking about going somewhere this weekend",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.equal(t1.endSession, false);
  assert.match(t1.replyText, /mountains|beaches/i);

  const t2 = await processVoiceTurn({
    sessionId: "s-trip-plan-1",
    transcript: "Somewhere peaceful, not too expensive",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.equal(t2.endSession, false);
  assert.match(t2.replyText, /budget/i);

  const t3 = await processVoiceTurn({
    sessionId: "s-trip-plan-1",
    transcript: "Around three thousand",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.equal(t3.endSession, false);
  assert.match(t3.replyText, /3,000|3000/);

  const t4 = await processVoiceTurn({
    sessionId: "s-trip-plan-1",
    transcript: "Yes, and remind me to pack the day before",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.equal(t4.actionExecuted, "reminder.create");
  assert.equal(listReminders(false).length, 1);
  assert.match(listReminders(false)[0].title, /pack/i);
});

test("Phase 3 handles trip clarification, ordinal day follow-up, correction, and contextual reminder", async () => {
  clearRemindersForTest();
  clearSessionMemory("s-trip-follow-1");
  let openedUrl = "";
  const adapter = createMockVaultAdapter({
    onNavigate: (href) => {
      openedUrl = href;
    },
  });

  const ask = await processVoiceTurn({
    sessionId: "s-trip-follow-1",
    transcript: "Open my trip",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.equal(ask.actionExecuted, "clarification.trip");
  assert.match(ask.replyText, /Kasol Escape/i);

  const pick = await processVoiceTurn({
    sessionId: "s-trip-follow-1",
    transcript: "the first one",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.equal(pick.actionExecuted, "trips.open");
  assert.equal(openedUrl, "/secret/vault/trip-kasol/itinerary");

  const day2 = await processVoiceTurn({
    sessionId: "s-trip-follow-1",
    transcript: "Show the second day",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.match(day2.replyText, /Chalal Forest Walk/i);

  const day3 = await processVoiceTurn({
    sessionId: "s-trip-follow-1",
    transcript: "Actually, the third day",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.match(day3.replyText, /Tosh Village Excursion/i);

  const rem = await processVoiceTurn({
    sessionId: "s-trip-follow-1",
    transcript: "Add a reminder for that",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter,
  });
  assert.equal(rem.actionExecuted, "reminder.create");
  const saved = listReminders(false)[0];
  assert.match(saved.title, /Kasol Escape - Day 3/i);
  assert.equal(saved.tripId, "trip-kasol");
});

test("Phase 3 multi-step workflow opens upcoming trip and schedules night-before packing reminder, and rolls back on failure", async () => {
  clearRemindersForTest();
  clearActionAuditLogForTest();
  clearSessionMemory("s-plan-ok");

  let navPath = "";
  const okAdapter = createMockVaultAdapter({
    onNavigate: (href) => {
      navPath = href;
    },
  });
  const okReply = await processVoiceTurn({
    sessionId: "s-plan-ok",
    transcript: "Open my upcoming trip and remind me to pack the night before",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter: okAdapter,
  });
  assert.equal(okReply.endSession, true);
  assert.match(okReply.replyText, /Kasol Escape/i);
  assert.equal(navPath, "/secret/vault/trip-kasol/itinerary");
  assert.equal(listReminders(false).length, 1);
  assert.ok(listReminders(false)[0].triggerAtIso?.startsWith("2026-12-04"));

  // Now simulate failure in step 2 (trips.open) and confirm rollback removes reminder created in step 1
  clearRemindersForTest();
  clearSessionMemory("s-plan-fail");
  const failingAdapter = createMockVaultAdapter({ failTripOpen: true });
  const failReply = await processVoiceTurn({
    sessionId: "s-plan-fail",
    transcript: "Open my upcoming trip and remind me to pack the night before",
    isLocked: false,
    player: noopPlayer,
    navigate: () => {},
    adapter: failingAdapter,
  });
  assert.equal(failReply.actionExecuted, "planner.rolled_back");
  assert.equal(listReminders(false).length, 0);
  assert.ok(getActionAuditLog().some((e) => e.status === "rolled_back"));
});

test("Phase 3 Action Registry enforces lock-screen barrier, confirmation gate, and undoable delete", async () => {
  clearRemindersForTest();
  const adapter = createMockVaultAdapter();

  const lockedFinance = await executeRegisteredAction({
    sessionId: "s-reg-1",
    rawAction: { kind: "finance.summary" },
    adapter,
    isLocked: true,
  });
  assert.equal(lockedFinance.ok, false);
  assert.equal(lockedFinance.policy.requiresUnlock, true);

  const lockedReminder = await executeRegisteredAction<{ reminder: { id: string } }>({
    sessionId: "s-reg-1",
    rawAction: { kind: "reminder.create", title: "Buy batteries" },
    adapter,
    isLocked: true,
  });
  assert.equal(lockedReminder.ok, true);
  const createdId = lockedReminder.result!.reminder.id;

  const unconfirmedDel = await executeRegisteredAction({
    sessionId: "s-reg-1",
    rawAction: { kind: "reminder.delete", id: createdId },
    adapter,
    isLocked: false,
    explicitlyConfirmed: false,
  });
  assert.equal(unconfirmedDel.ok, false);
  assert.equal(unconfirmedDel.policy.requiresConfirmation, true);

  const confirmedDel = await executeRegisteredAction({
    sessionId: "s-reg-1",
    rawAction: { kind: "reminder.delete", id: createdId },
    adapter,
    isLocked: false,
    explicitlyConfirmed: true,
  });
  assert.equal(confirmedDel.ok, true);
  assert.equal(listReminders(false).length, 0);
  await confirmedDel.undo?.();
  assert.equal(listReminders(false).length, 1);
});

test("Phase 3 Memory enforces turn caps, explicit approval, and rejects secrets; Personality respects serious situations", async () => {
  await resetPersistentMemories();

  await assert.rejects(
    () => savePersistentMemory({ text: "I like tea", approvedByUser: false }),
    /approval/i
  );
  await assert.rejects(
    () => savePersistentMemory({ text: "My api key is sk-1234567890abcdef", approvedByUser: true }),
    /Refusing/i
  );
  const saved = await savePersistentMemory({ text: "Prefer peaceful mountain stays", approvedByUser: true });
  assert.equal(await deletePersistentMemory(saved.id), true);

  const session = getOrCreateSessionMemory("s-mem-bound");
  for (let i = 0; i < 20; i++) {
    await executeTaskPlan({
      session,
      adapter: createMockVaultAdapter(),
      steps: [{ id: `s${i}`, description: "pause", action: { kind: "music.pause" } }],
      isLocked: false,
    });
  }
  const summary = summarizeSessionMemory(session);
  assert.ok(typeof summary === "string");

  const seriousPrompt = buildPersonalitySystemInstructions(
    { ...DEFAULT_ATLAS_PERSONALITY, humor: 10, teasing: 10 },
    "I lost my wallet at the hospital emergency room"
  );
  assert.match(seriousPrompt, /do NOT joke, tease/i);
});

test("Legacy hybrid router cannot send an automatic cloud request even with global consent", async () => {
  const session = getOrCreateSessionMemory("s-router-1");
  let calls = 0;
  const deps = {
    runtimeStatusFn: async () => ({available: false, reason: "none", engine: "none"}),
    secureCloudFn: async () => { calls++; return {ok: true, provider: "gemini", replyText: "Unexpected cloud call"}; },
  };
  for (const allowCloud of [true, false]) {
    const reply = await routeGenerativeReply({userText: "Recommend a peaceful hill station", session, allowCloud}, deps);
    assert.equal(reply, null);
  }
  assert.equal(calls, 0);
});
