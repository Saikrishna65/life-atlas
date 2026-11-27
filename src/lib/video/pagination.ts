import { readChannelId } from "./channel";
import type { VideoResult } from "./search";
/** Anonymous provider pagination state, held only for the currently displayed search. */
export interface SearchContinuation { token: string; visitorData?: string; }
export function readContinuation(value: unknown): SearchContinuation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { token, visitorData } = value as Record<string, unknown>;
  const opaque = (text: unknown, max: number): text is string => typeof text === "string" && text.length > 0 && text.length <= max && /^[\x21-\x7e]+$/.test(text);
  if (!opaque(token, 16384) || visitorData !== undefined && !opaque(visitorData, 2048)) return null;
  return { token, ...(typeof visitorData === "string" ? { visitorData } : {}) };
}
export function readVideoPage(value: unknown): VideoResult[] {
  if (!Array.isArray(value)) return [];
  const items: VideoResult[] = [], seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(entry.id) || typeof entry.title !== "string" || seen.has(entry.id)) continue;
    seen.add(entry.id);
    items.push({ id: entry.id, title: entry.title.slice(0, 500), ...(readChannelId(entry.channelId) ? { channelId: entry.channelId } : {}), channel: typeof entry.channel === "string" ? entry.channel.slice(0, 200) : "", duration: typeof entry.duration === "string" ? entry.duration.slice(0, 40) : "", thumbnail: `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg` });
  }
  return items;
}
export function appendVideoPage(current: VideoResult[], incoming: VideoResult[]): VideoResult[] {
  const seen = new Set(current.map((video) => video.id));
  return [...current, ...incoming.filter((video) => { if (seen.has(video.id)) return false; seen.add(video.id); return true; })];
}
