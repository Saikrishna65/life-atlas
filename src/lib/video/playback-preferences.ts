"use client";
import { useSyncExternalStore } from "react";
export const PLAYBACK_STORAGE_KEY = "atlas-video-playback";
const defaults = Object.freeze({ autoplay: true, related: true });
export function readPlaybackPreferences(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...defaults };
  const entry = value as Record<string, unknown>;
  return { autoplay: typeof entry.autoplay === "boolean" ? entry.autoplay : true, related: typeof entry.related === "boolean" ? entry.related : true };
}
let fallback = "11";
function snapshot(): string {
  try {
    const value = readPlaybackPreferences(JSON.parse(localStorage.getItem(PLAYBACK_STORAGE_KEY) || "null"));
    return `${Number(value.autoplay)}${Number(value.related)}`;
  } catch { return fallback; }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener("atlas-video-playback", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("atlas-video-playback", listener); };
}
export function usePlaybackPreferences() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "11");
  const preferences = { autoplay: value[0] === "1", related: value[1] === "1" };
  return { ...preferences, update: (key: keyof typeof preferences, enabled: boolean) => {
    const next = { ...preferences, [key]: enabled };
    fallback = `${Number(next.autoplay)}${Number(next.related)}`;
    try { localStorage.setItem(PLAYBACK_STORAGE_KEY, JSON.stringify(next)); } catch {}
    window.dispatchEvent(new Event("atlas-video-playback"));
  } };
}
