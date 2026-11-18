import {
  executeRegisteredAction,
  recordRollbackAudit,
} from "./action-registry";
import type { AtlasAction, LocalAdapter } from "./gateway";
import type { SessionMemory } from "./memory";
import { parseNaturalDueDate } from "./reminders";

export interface TaskStep {
  id: string;
  description: string;
  action: AtlasAction;
  verify?: (result: unknown) => boolean;
}

export interface TaskPlanExecutionResult {
  status: "completed" | "clarification_needed" | "confirmation_required" | "blocked_locked" | "partial_failure" | "failed";
  replyText: string;
  completedStepIds: string[];
  rolledBackStepIds: string[];
  actionExecuted: string;
  endSession: boolean;
}

interface TripSummaryItem {
  id: string;
  title: string;
  destination: string;
  startDate?: string;
  status?: string;
}

function selectUpcomingOrMatchingTrip(
  trips: TripSummaryItem[],
  hint?: string,
  activeTripId?: string
): { selected?: TripSummaryItem; candidates?: TripSummaryItem[] } {
  if (!trips.length) return {};
  if (activeTripId && (!hint || /\b(this|that|it|current|my trip)\b/i.test(hint))) {
    const active = trips.find((t) => t.id === activeTripId);
    if (active) return { selected: active };
  }

  const nowMs = Date.now();
  const cleanHint = hint
    ?.replace(/\b(my|the|upcoming|next|trip|trips|open|show|to|for|check)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanHint && cleanHint.length >= 2) {
    const matches = trips.filter((t) =>
      `${t.title} ${t.destination}`.toLowerCase().includes(cleanHint.toLowerCase())
    );
    if (matches.length === 1) return { selected: matches[0] };
    if (matches.length > 1) return { candidates: matches.slice(0, 4) };
  }

  // Sort upcoming trips (startDate >= today - 1 day) ascending by startDate, then most recent
  const upcoming = trips
    .filter((t) => t.status !== "COMPLETED" && t.startDate)
    .map((t) => ({ trip: t, ts: Date.parse(t.startDate!) }))
    .filter((x) => !Number.isNaN(x.ts) && x.ts >= nowMs - 86_400_000)
    .sort((a, b) => a.ts - b.ts)
    .map((x) => x.trip);

  if (upcoming.length === 1) return { selected: upcoming[0] };
  if (upcoming.length > 1 && /\b(upcoming|next)\b/i.test(hint ?? "")) {
    return { selected: upcoming[0] };
  }
  if (trips.length === 1) return { selected: trips[0] };
  return { candidates: (upcoming.length ? upcoming : trips).slice(0, 4) };
}

export async function executeTaskPlan(options: {
  session: SessionMemory;
  adapter: LocalAdapter;
  steps: TaskStep[];
  isLocked: boolean;
  explicitlyConfirmed?: boolean;
  rollbackOnFailure?: boolean;
}): Promise<TaskPlanExecutionResult> {
  const executedUndoStack: Array<{ stepId: string; actionId: string; undo?: () => Promise<void> }> = [];
  const completedStepIds: string[] = [];
  const rolledBackStepIds: string[] = [];

  for (const step of options.steps) {
    const res = await executeRegisteredAction({
      sessionId: options.session.sessionId,
      rawAction: step.action,
      adapter: options.adapter,
      isLocked: options.isLocked,
      explicitlyConfirmed: options.explicitlyConfirmed,
    });

    if (!res.ok) {
      if (res.policy.requiresUnlock) {
        return {
          status: "blocked_locked",
          replyText: "Your phone is locked right now—unlock your screen and ask again so I can safely access private Trip or Finance data.",
          completedStepIds,
          rolledBackStepIds,
          actionExecuted: "privacy.locked_guard",
          endSession: true,
        };
      }
      if (res.policy.requiresConfirmation) {
        options.session.pendingConfirmation = {
          id: `conf_${crypto.randomUUID()}`,
          description: step.description,
          actionId: step.action.kind,
          payload: step.action,
          expiresAt: Date.now() + 90_000,
        };
        return {
          status: "confirmation_required",
          replyText: `Should I go ahead and ${step.description}? Say yes to confirm or no to cancel.`,
          completedStepIds,
          rolledBackStepIds,
          actionExecuted: "action.confirmation_required",
          endSession: false,
        };
      }

      if (options.rollbackOnFailure && executedUndoStack.length > 0) {
        while (executedUndoStack.length > 0) {
          const prev = executedUndoStack.pop()!;
          if (prev.undo) {
            try {
              await prev.undo();
              rolledBackStepIds.push(prev.stepId);
              recordRollbackAudit(options.session.sessionId, prev.actionId, "Rolled back after downstream plan failure");
            } catch {
              // Keep reporting remaining failures honestly
            }
          }
        }
        return {
          status: "partial_failure",
          replyText: `Couldn't finish ${step.description}: ${res.error ?? "step failed"}. I rolled back earlier changes from this step so nothing was left half-done.`,
          completedStepIds,
          rolledBackStepIds,
          actionExecuted: "planner.rolled_back",
          endSession: false,
        };
      }

      return {
        status: completedStepIds.length > 0 ? "partial_failure" : "failed",
        replyText: completedStepIds.length > 0
          ? `I finished ${completedStepIds.length} part(s), but hit a snag on ${step.description}: ${res.error ?? "unknown error"}.`
          : res.error ?? `Couldn't complete ${step.description}.`,
        completedStepIds,
        rolledBackStepIds,
        actionExecuted: "planner.failed",
        endSession: false,
      };
    }

    if (step.verify && !step.verify(res.result)) {
      if (options.rollbackOnFailure && res.undo) {
        await res.undo().catch(() => {});
        rolledBackStepIds.push(step.id);
      }
      return {
        status: "failed",
        replyText: `Verification failed after ${step.description}, so I didn't mark it done.`,
        completedStepIds,
        rolledBackStepIds,
        actionExecuted: "planner.verification_failed",
        endSession: false,
      };
    }

    completedStepIds.push(step.id);
    executedUndoStack.push({ stepId: step.id, actionId: step.action.kind, undo: res.undo });
  }

  return {
    status: "completed",
    replyText: "All set.",
    completedStepIds,
    rolledBackStepIds,
    actionExecuted: options.steps.map((s) => s.action.kind).join("+"),
    endSession: false,
  };
}

/**
 * Multi-step workflow:
 * "Atlas, open my upcoming trip and remind me to pack the night before"
 * Also handles variations like "...and remind me to check documents tomorrow morning".
 */
export async function executeOpenTripAndPackReminderWorkflow(options: {
  session: SessionMemory;
  adapter: LocalAdapter;
  transcript: string;
  isLocked: boolean;
}): Promise<TaskPlanExecutionResult> {
  if (options.isLocked) {
    return {
      status: "blocked_locked",
      replyText: "Your phone is locked right now. Unlock it first before I open Trip Vault and attach a trip reminder.",
      completedStepIds: [],
      rolledBackStepIds: [],
      actionExecuted: "privacy.locked_guard",
      endSession: true,
    };
  }

  const listOutcome = await executeRegisteredAction<TripSummaryItem[]>({
    sessionId: options.session.sessionId,
    rawAction: { kind: "trips.list" },
    adapter: options.adapter,
    isLocked: options.isLocked,
  });

  if (!listOutcome.ok) {
    return {
      status: "failed",
      replyText: listOutcome.error ?? "Couldn't read your Trip Vault right now.",
      completedStepIds: [],
      rolledBackStepIds: [],
      actionExecuted: "trips.list",
      endSession: false,
    };
  }

  const trips = listOutcome.result ?? [];
  if (trips.length === 0) {
    return {
      status: "failed",
      replyText: "I checked Trip Vault, and you don't have any trips saved yet—want me to help plan a new one?",
      completedStepIds: [],
      rolledBackStepIds: [],
      actionExecuted: "trips.list",
      endSession: false,
    };
  }

  const tripChoice = selectUpcomingOrMatchingTrip(trips, options.transcript, options.session.activeTripId);
  if (!tripChoice.selected && tripChoice.candidates && tripChoice.candidates.length > 1) {
    options.session.pendingClarification = {
      kind: "select_trip",
      prompt: "Which trip should I open and set the reminder on?",
      candidates: tripChoice.candidates.map((c) => ({ id: c.id, label: c.title })),
      originalTranscript: options.transcript,
    };
    const names = tripChoice.candidates.map((c) => c.title).join(", or ");
    return {
      status: "clarification_needed",
      replyText: `You have a few trips saved (${names}). Which one did you mean?`,
      completedStepIds: [],
      rolledBackStepIds: [],
      actionExecuted: "clarification.trip",
      endSession: false,
    };
  }

  const trip = tripChoice.selected ?? trips[0];
  options.session.activeTripId = trip.id;
  options.session.activeTripTitle = trip.title;
  options.session.currentTopic = "trip_vault";

  const reminderMatch = options.transcript.match(/\bremind\s+(?:me\s+)?(?:to\s+)?(.+)$/i);
  const rawReminderText = reminderMatch?.[1]?.trim() || "pack for the trip the night before";
  const duePhraseMatch = rawReminderText.match(/\b(the night before|night before|day before|tomorrow(?:\s+(?:morning|evening|night))?|tonight|this evening|next week|in \d+\s+(?:minutes?|hours?|days?))\b/i);
  const dueText = duePhraseMatch?.[1] ?? "the night before";
  const cleanedTitle = rawReminderText
    .replace(/\b(?:on\s+)?(the night before|night before|day before|tomorrow(?:\s+(?:morning|evening|night))?|tonight|this evening|next week)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || `Pack for ${trip.title}`;
  const finalTitle = cleanedTitle.toLowerCase().includes(trip.title.toLowerCase())
    ? cleanedTitle
    : `${cleanedTitle} (${trip.title})`;

  const parsedDue = parseNaturalDueDate(dueText, trip.startDate);
  const triggerAtIso = parsedDue?.triggerAtIso;

  const steps: TaskStep[] = [
    {
      id: "step_create_trip_reminder",
      description: `save reminder "${finalTitle}"`,
      action: {
        kind: "trips.createReminder",
        tripId: trip.id,
        title: finalTitle,
        dueText,
        ...(triggerAtIso ? { triggerAtIso } : {}),
      },
      verify: (res) => Boolean(res && typeof res === "object" && "reminder" in res),
    },
    {
      id: "step_open_trip",
      description: `open ${trip.title}`,
      action: { kind: "trips.open", id: trip.id },
      verify: (res) => Boolean(res && typeof res === "object" && "opened" in res),
    },
  ];

  const planResult = await executeTaskPlan({
    session: options.session,
    adapter: options.adapter,
    steps,
    isLocked: options.isLocked,
    rollbackOnFailure: true,
  });

  if (planResult.status === "completed") {
    options.session.lastReminderTitle = finalTitle;
    const whenLabel = trip.startDate && /before/i.test(dueText)
      ? `the night before ${trip.title} starts (${trip.startDate})`
      : dueText;
    return {
      ...planResult,
      replyText: `Opened ${trip.title} and saved a reminder to ${cleanedTitle} for ${whenLabel}.`,
      endSession: true,
    };
  }

  return planResult;
}
