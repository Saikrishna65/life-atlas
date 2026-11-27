import { deviceIsLocked } from "./native";
import {
  parseAction,
  permissionFor,
  type AtlasAction,
  type LocalAdapter,
  type Permission,
} from "./gateway";
import {
  CONFIRMATION_REQUIRED_ACTION_IDS,
  LOCK_SCREEN_SAFE_ACTION_IDS,
  evaluateActionPolicy,
  type PolicyEvaluation,
} from "./policy";
import { deleteReminder, restoreReminder, updateReminder } from "./reminders";

export type AtlasActionCategory =
  | "music"
  | "trips"
  | "finance"
  | "reminders"
  | "control"
  | "navigation";

export interface AtlasActionSpec {
  id: AtlasAction["kind"];
  category: AtlasActionCategory;
  description: string;
  requiredPermission: Permission;
  lockScreenAllowed: boolean;
  requiresConfirmation: boolean;
  undoable: boolean;
}

export interface ActionAuditEntry {
  id: string;
  actionId: string;
  category: AtlasActionCategory;
  sessionId: string;
  status:
    | "executed"
    | "blocked_locked"
    | "confirmation_required"
    | "failed"
    | "rolled_back";
  reason?: string;
  at: string;
}

export interface ActionExecutionResult<T = unknown> {
  ok: boolean;
  action: AtlasAction;
  policy: PolicyEvaluation;
  result?: T;
  error?: string;
  undo?: () => Promise<void>;
}

const MAX_AUDIT_ENTRIES = 60;
const auditLog: ActionAuditEntry[] = [];

function recordAudit(entry: Omit<ActionAuditEntry, "id" | "at">): void {
  auditLog.unshift({
    ...entry,
    id: `aud_${crypto.randomUUID()}`,
    at: new Date().toISOString(),
  });
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.length = MAX_AUDIT_ENTRIES;
  }
}

export function getActionAuditLog(): ActionAuditEntry[] {
  return [...auditLog];
}

export function clearActionAuditLogForTest(): void {
  auditLog.length = 0;
}

function spec(
  id: AtlasAction["kind"],
  category: AtlasActionCategory,
  description: string,
  undoable = false,
): AtlasActionSpec {
  return {
    id,
    category,
    description,
    requiredPermission: permissionFor(minimalActionForPermission(id)),
    lockScreenAllowed: LOCK_SCREEN_SAFE_ACTION_IDS.has(id),
    requiresConfirmation: CONFIRMATION_REQUIRED_ACTION_IDS.has(id),
    undoable,
  };
}

function minimalActionForPermission(kind: AtlasAction["kind"]): AtlasAction {
  switch (kind) {
    case "navigate":
      return { kind: "navigate", section: "home" };
    case "control.status":
      return { kind: "control.status" };
    case "reminder.create":
      return { kind: "reminder.create", title: "stub" };
    case "reminder.list":
      return { kind: "reminder.list" };
    case "reminder.update":
      return { kind: "reminder.update", id: "stub" };
    case "reminder.complete":
      return { kind: "reminder.complete", id: "stub" };
    case "reminder.delete":
      return { kind: "reminder.delete", id: "stub" };
    case "finance.summary":
    case "finance.explainCategories":
    case "finance.budgetHelp":
      return { kind };
    case "finance.searchExpenses":
      return { kind: "finance.searchExpenses", query: "stub" };
    case "finance.expense":
      return {
        kind: "finance.expense",
        accountId: "a",
        amountPaise: 100,
        description: "stub",
      };
    case "finance.categorize":
      return { kind: "finance.categorize", id: "t", categoryId: "c" };
    case "trips.list":
      return { kind: "trips.list" };
    case "trips.search":
      return { kind: "trips.search", query: "stub" };
    case "trips.open":
    case "trips.itinerary":
    case "trips.getDetails":
      return { kind, id: "t" };
    case "trips.editTitle":
      return { kind: "trips.editTitle", tripId: "t", dayId: "d", title: "x" };
    case "trips.addNote":
      return { kind: "trips.addNote", id: "t", note: "x" };
    case "trips.createReminder":
      return { kind: "trips.createReminder", tripId: "t", title: "x" };
    case "music.search":
      return { kind: "music.search", query: "stub" };
    case "music.play":
    case "music.playlist":
      return { kind, id: "m" };
    case "music.setPlaybackRate":
      return { kind: "music.setPlaybackRate", rate: 1 };
    case "music.pause":
    case "music.resume":
    case "music.next":
    case "music.previous":
    case "music.state":
    case "music.toggleShuffle":
    case "music.cycleRepeat":
      return { kind };
  }
}

export const ATLAS_ACTION_REGISTRY: Record<
  AtlasAction["kind"],
  AtlasActionSpec
> = {
  "music.search": spec(
    "music.search",
    "music",
    "Search local offline music tracks by title, artist, album, or genre",
  ),
  "music.play": spec(
    "music.play",
    "music",
    "Play a downloaded local music track",
  ),
  "music.playlist": spec(
    "music.playlist",
    "music",
    "Open and play downloaded tracks from a saved playlist",
  ),
  "music.pause": spec("music.pause", "music", "Pause current audio playback"),
  "music.resume": spec("music.resume", "music", "Resume paused audio playback"),
  "music.next": spec(
    "music.next",
    "music",
    "Skip to the next downloaded track in queue",
  ),
  "music.previous": spec(
    "music.previous",
    "music",
    "Go back to the previous track in queue",
  ),
  "music.state": spec(
    "music.state",
    "music",
    "Report the currently playing track and playback settings",
  ),
  "music.setPlaybackRate": spec(
    "music.setPlaybackRate",
    "music",
    "Adjust audio playback speed between 0.5x and 2.0x",
  ),
  "music.toggleShuffle": spec(
    "music.toggleShuffle",
    "music",
    "Toggle shuffle mode on the music player",
  ),
  "music.cycleRepeat": spec(
    "music.cycleRepeat",
    "music",
    "Cycle repeat mode (Off, All, One)",
  ),

  "trips.list": spec(
    "trips.list",
    "trips",
    "List upcoming and saved trips in Atlas Trips",
  ),
  "trips.search": spec(
    "trips.search",
    "trips",
    "Search trips by title or destination",
  ),
  "trips.open": spec("trips.open", "trips", "Open a trip's itinerary view"),
  "trips.itinerary": spec(
    "trips.itinerary",
    "trips",
    "Read a trip's day-by-day itinerary",
  ),
  "trips.getDetails": spec(
    "trips.getDetails",
    "trips",
    "Inspect dates, budget, and notes for a trip",
  ),
  "trips.editTitle": spec(
    "trips.editTitle",
    "trips",
    "Rename an itinerary day title (confirmation required)",
  ),
  "trips.addNote": spec(
    "trips.addNote",
    "trips",
    "Append a note to an existing trip (confirmation required)",
  ),
  "trips.createReminder": spec(
    "trips.createReminder",
    "trips",
    "Create a packing or departure reminder linked to a trip",
    true,
  ),

  "finance.summary": spec(
    "finance.summary",
    "finance",
    "Summarize active accounts, balances, categories, and recent expenses",
  ),
  "finance.searchExpenses": spec(
    "finance.searchExpenses",
    "finance",
    "Search recent expenses and transactions",
  ),
  "finance.explainCategories": spec(
    "finance.explainCategories",
    "finance",
    "Break down spending totals across expense categories",
  ),
  "finance.budgetHelp": spec(
    "finance.budgetHelp",
    "finance",
    "Inspect configured monthly/period budgets (read-only advice unless confirmed)",
  ),
  "finance.expense": spec(
    "finance.expense",
    "finance",
    "Record a new outflow expense (confirmation required)",
  ),
  "finance.categorize": spec(
    "finance.categorize",
    "finance",
    "Recategorize an existing transaction (confirmation required)",
  ),

  "reminder.create": spec(
    "reminder.create",
    "reminders",
    "Create a reminder with optional due phrase and trip link",
    true,
  ),
  "reminder.list": spec(
    "reminder.list",
    "reminders",
    "List active pending reminders",
  ),
  "reminder.update": spec(
    "reminder.update",
    "reminders",
    "Update an existing reminder's title or due time",
    true,
  ),
  "reminder.complete": spec(
    "reminder.complete",
    "reminders",
    "Mark a reminder completed",
    true,
  ),
  "reminder.delete": spec(
    "reminder.delete",
    "reminders",
    "Delete a reminder permanently (confirmation required, undoable in-session)",
    true,
  ),

  "control.status": spec(
    "control.status",
    "control",
    "Check wake-word, restore, and Cloud AI consent status",
  ),
  navigate: spec(
    "navigate",
    "navigation",
    "Navigate to a Atlas workspace section",
  ),
};

export function listRegisteredActions(): AtlasActionSpec[] {
  return Object.values(ATLAS_ACTION_REGISTRY);
}

export function getActionSpec(actionId: AtlasAction["kind"]): AtlasActionSpec {
  return ATLAS_ACTION_REGISTRY[actionId];
}

export async function executeRegisteredAction<T = unknown>(options: {
  sessionId: string;
  rawAction: unknown;
  adapter: LocalAdapter;
  isLocked: boolean;
  explicitlyConfirmed?: boolean;
  grantedPermissions?: ReadonlySet<Permission>;
  onUndo?: () => Promise<void>;
}): Promise<ActionExecutionResult<T>> {
  const action = Object.freeze(parseAction(options.rawAction));
  const actionSpec = getActionSpec(action.kind);

  const policy = evaluateActionPolicy({
    actionId: action.kind,
    isLocked: options.isLocked || (await deviceIsLocked()),
    explicitlyConfirmed: options.explicitlyConfirmed,
  });

  if (
    options.grantedPermissions &&
    !options.grantedPermissions.has(actionSpec.requiredPermission)
  ) {
    const deniedPolicy: PolicyEvaluation = {
      allowed: false,
      requiresUnlock: false,
      requiresConfirmation: false,
      reason: `Permission required: ${actionSpec.requiredPermission}`,
    };
    recordAudit({
      actionId: action.kind,
      category: actionSpec.category,
      sessionId: options.sessionId,
      status: "failed",
      reason: deniedPolicy.reason,
    });
    return {
      ok: false,
      action,
      policy: deniedPolicy,
      error: deniedPolicy.reason,
    };
  }

  if (!policy.allowed) {
    recordAudit({
      actionId: action.kind,
      category: actionSpec.category,
      sessionId: options.sessionId,
      status: policy.requiresUnlock
        ? "blocked_locked"
        : "confirmation_required",
      reason: policy.reason,
    });
    return { ok: false, action, policy, error: policy.reason };
  }

  const guard = () => {
    if (options.isLocked && !actionSpec.lockScreenAllowed) {
      throw new Error("Device is locked.");
    }
  };

  try {
    if (typeof window !== "undefined") {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { authorize } = await import("../security/authentication");
        await authorize("app");
        await authorize("privateSections");
        await authorize("aiActions");
      }
    }
    let result: unknown;
    if (
      action.kind === "finance.expense" ||
      action.kind === "finance.categorize" ||
      action.kind === "trips.editTitle"
    ) {
      const prepared = await options.adapter.prepare(action, guard);
      result = await prepared.commit();
    } else {
      result = await options.adapter.execute(action, guard);
    }

    let undoFn: (() => Promise<void>) | undefined;
    if (
      (action.kind === "reminder.create" ||
        action.kind === "trips.createReminder") &&
      result &&
      typeof result === "object" &&
      "reminder" in result
    ) {
      const created = (result as { reminder?: { id?: string } }).reminder;
      if (created?.id) {
        const createdId = created.id;
        undoFn = async () => {
          deleteReminder(createdId);
        };
      }
    } else if (action.kind === "reminder.complete") {
      const id = action.id;
      undoFn = async () => {
        updateReminder(id, { completed: false });
      };
    } else if (
      action.kind === "reminder.delete" &&
      result &&
      typeof result === "object" &&
      "snapshot" in result
    ) {
      const snap = (
        result as { snapshot?: Parameters<typeof restoreReminder>[0] }
      ).snapshot;
      if (snap) {
        undoFn = async () => {
          restoreReminder(snap);
        };
      }
    }

    recordAudit({
      actionId: action.kind,
      category: actionSpec.category,
      sessionId: options.sessionId,
      status: "executed",
    });

    return {
      ok: true,
      action,
      policy,
      result: result as T,
      undo: undoFn,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Action failed.";
    recordAudit({
      actionId: action.kind,
      category: actionSpec.category,
      sessionId: options.sessionId,
      status: "failed",
      reason: msg,
    });
    return {
      ok: false,
      action,
      policy,
      error: msg,
    };
  }
}

export function recordRollbackAudit(
  sessionId: string,
  actionId: string,
  reason: string,
): void {
  const existing = ATLAS_ACTION_REGISTRY[actionId as AtlasAction["kind"]];
  recordAudit({
    actionId,
    category: existing ? existing.category : "control",
    sessionId,
    status: "rolled_back",
    reason,
  });
}
