import { parseAction, type AtlasAction } from "../gateway";
/** Model output is untrusted data. A schema-valid proposal is never an execution receipt. */
export function parseLocalEnvelope(raw: string): {
  reply: string;
  action: AtlasAction | null;
} {
  if (raw.length > 16000) throw new Error("Model output exceeds limit");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected response object");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some((k) => !["reply", "action"].includes(k)) ||
    typeof v.reply !== "string" ||
    v.reply.length > 2000
  )
    throw new Error("Invalid model response envelope");
  return {
    reply: v.reply.trim(),
    action: v.action === null ? null : parseAction(v.action),
  };
}
export const LOCAL_RESPONSE_RULES = `Return exactly one JSON object with keys "reply" (short conversational string) and "action" (null or a supported Atlas action object). Never claim an action has succeeded: this response is only a proposal. Ask a clarification if an ID or other required argument is unknown. Never invent IDs, vault facts, or permissions. For ordinary conversation set action to null. Do not include reasoning, hidden analysis, markdown fences or extra keys. Harmless humor and mature conversation are allowed; action safety and permissions remain mandatory.`;
