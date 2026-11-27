import { youtubeId } from "./search";
export const MAX_VIDEO_SUGGESTIONS = 8;
/** Treat ordinary eleven-letter words as searches, while keeping common raw IDs and video URLs convenient. */
export function directVideoId(value: string): string | null {
  const text = value.trim();
  return /^https:\/\//i.test(text) || /^[A-Za-z0-9_-]{11}$/.test(text) && /[0-9_-]/.test(text) ? youtubeId(text) : null;
}
export function suggestionQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  // Never send pasted URLs, protocols or control characters for automatic completion.
  if (!text || text.length > 120 || /[\u0000-\u001f\u007f]/.test(text) || (/^[a-z][a-z\d+.-]*:/i.test(text) || /(?:https?:\/\/|www\.|youtu\.be\/|(?:m\.)?youtube\.com\/)/i.test(text)) || directVideoId(text)) return null;
  return text.replace(/\s+/g, " ");
}
export function suggestionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const text = entry.trim().replace(/\s+/g, " ");
    if (!text || text.length > 120 || /[\u0000-\u001f\u007f]/.test(entry) || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase()); items.push(text);
    if (items.length === MAX_VIDEO_SUGGESTIONS) break;
  }
  return items;
}
export function parseSuggestionResponse(value: unknown): string[] {
  return Array.isArray(value) ? suggestionList(value[1]) : [];
}
