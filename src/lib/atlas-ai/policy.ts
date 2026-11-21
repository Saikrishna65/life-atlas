/**
 * Unified Atlas AI Privacy, Lock-Screen & Confirmation Policy Engine (v1).
 *
 * Kept structurally aligned with native Android checks in AtlasVoiceCoordinator.kt so
 * foreground WebView sessions and background/locked native sessions enforce identical rules.
 */

export const ATLAS_POLICY_VERSION = "atlas-policy-v1";

export type PolicySensitivity = "public" | "personal_unlocked" | "sensitive_mutation";

export const LOCKED_SCREEN_BLOCKED_TERMS: readonly string[] = [
  "finance",
  "balance",
  "bank",
  "expense",
  "transaction",
  "money",
  "spent",
  "budget",
  "memory",
  "memories",
  "vault",
  "trip",
  "itinerary",
  "booking",
  "document",
  "pnr",
  "password",
  "passphrase",
  "credential",
  "secret",
];

export const SERIOUS_OR_SAFETY_TERMS: readonly string[] = [
  "emergency",
  "hospital",
  "accident",
  "medical",
  "police",
  "sos",
  "lost wallet",
  "stolen",
  "fraud",
  "unauthorized",
  "delete",
  "password",
  "error",
  "crashed",
];

export const LOCK_SCREEN_SAFE_ACTION_IDS: ReadonlySet<string> = new Set([
  "music.pause",
  "music.resume",
  "music.next",
  "music.previous",
  "music.state",
  "reminder.create",
  "control.status",
]);

export const CONFIRMATION_REQUIRED_ACTION_IDS: ReadonlySet<string> = new Set([
  "finance.expense",
  "finance.categorize",
  "finance.budgetHelp",
  "trips.editTitle",
  "trips.addNote",
  "reminder.delete",
  "security.change",
  "media.publish",
  "media.share",
]);

export function containsSensitiveVaultQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return LOCKED_SCREEN_BLOCKED_TERMS.some((term) => lower.includes(term));
}

export function isSeriousSituation(text: string): boolean {
  const lower = text.toLowerCase();
  return SERIOUS_OR_SAFETY_TERMS.some((term) => lower.includes(term));
}

export interface PolicyEvaluation {
  allowed: boolean;
  requiresUnlock: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

export function evaluateActionPolicy(options: {
  actionId: string;
  isLocked: boolean;
  explicitlyConfirmed?: boolean;
}): PolicyEvaluation {
  const { actionId, isLocked, explicitlyConfirmed = false } = options;

  if (isLocked && !LOCK_SCREEN_SAFE_ACTION_IDS.has(actionId)) {
    return {
      allowed: false,
      requiresUnlock: true,
      requiresConfirmation: false,
      reason: `Your phone is locked. Please unlock it before I run "${actionId}".`,
    };
  }

  if (CONFIRMATION_REQUIRED_ACTION_IDS.has(actionId) && !explicitlyConfirmed) {
    return {
      allowed: false,
      requiresUnlock: false,
      requiresConfirmation: true,
      reason: `Action "${actionId}" requires your explicit confirmation first.`,
    };
  }

  return {
    allowed: true,
    requiresUnlock: false,
    requiresConfirmation: false,
  };
}
