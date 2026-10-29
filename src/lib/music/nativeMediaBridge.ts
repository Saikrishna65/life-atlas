/**
 * Native Android Foreground MediaPlayback & Lock-Screen Notification Bridge.
 * Connects the WebView MusicPlayerContext with `MediaPlaybackPlugin` + `MediaPlaybackService`
 * on Android so playback continues uninterrupted in the background / recent apps / locked screen
 * with a fixed Lock-Screen MediaSession controller.
 */
import { Capacitor, registerPlugin, PluginListenerHandle } from "@capacitor/core";

export type NativeMediaActionType =
  | "play"
  | "pause"
  | "toggle"
  | "next"
  | "previous"
  | "seek"
  | "stop"
  | "duck"
  | "unduck";

export interface NativeMediaActionEvent {
  action: NativeMediaActionType;
  positionMs?: number;
}

export interface NativePlaybackPayload {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  playbackRate: number;
}

export interface MediaPlaybackPluginInterface {
  updatePlayback(options: NativePlaybackPayload): Promise<{ granted?: boolean } | void>;
  stopPlayback(): Promise<void>;
  addListener(
    eventName: "mediaAction",
    listenerFunc: (event: NativeMediaActionEvent) => void
  ): Promise<PluginListenerHandle>;
}

export interface NativeBridgeAdapter {
  isAndroidNative: () => boolean;
  plugin: MediaPlaybackPluginInterface;
  eventTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
  origin?: string;
  now?: () => number;
}

const MediaPlayback = registerPlugin<MediaPlaybackPluginInterface>("MediaPlayback");

function defaultIsAndroidNative(): boolean {
  return (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android"
  );
}

const defaultAdapter: NativeBridgeAdapter = {
  isAndroidNative: defaultIsAndroidNative,
  plugin: MediaPlayback,
};

export function resolveArtworkUrl(artworkUrl?: string, origin?: string): string {
  if (!artworkUrl) return "";
  if (
    artworkUrl.startsWith("http://") ||
    artworkUrl.startsWith("https://") ||
    artworkUrl.startsWith("data:image")
  ) {
    return artworkUrl;
  }
  const baseOrigin =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (baseOrigin && artworkUrl.startsWith("/")) {
    return `${baseOrigin}${artworkUrl}`;
  }
  return "";
}

export function syncNativeMediaPlayback(
  payload: NativePlaybackPayload,
  adapter: NativeBridgeAdapter = defaultAdapter
): void {
  if (!adapter.isAndroidNative()) return;

  try {
    adapter.plugin
      .updatePlayback({
        title: payload.title || "Atlas Music Vault",
        artist: payload.artist || "Life Atlas",
        album: payload.album || "Music Vault",
        artworkUrl: resolveArtworkUrl(payload.artworkUrl, adapter.origin),
        isPlaying: payload.isPlaying,
        positionMs: Math.max(0, Math.round(payload.positionMs || 0)),
        durationMs: Math.max(0, Math.round(payload.durationMs || 0)),
        playbackRate: payload.playbackRate || 1,
      })
      .catch(() => {});
  } catch {
    // Graceful no-op if native plugin is unavailable on older APK builds
  }
}

export function stopNativeMediaPlayback(
  adapter: NativeBridgeAdapter = defaultAdapter
): void {
  if (!adapter.isAndroidNative()) return;

  try {
    adapter.plugin.stopPlayback().catch(() => {});
  } catch {
    // Graceful no-op
  }
}

export function subscribeNativeMediaActions(
  handler: (event: NativeMediaActionEvent) => void,
  adapter: NativeBridgeAdapter = defaultAdapter
): () => void {
  if (!adapter.isAndroidNative()) return () => {};

  const getNow = adapter.now ?? Date.now;
  const target =
    adapter.eventTarget ?? (typeof window !== "undefined" ? window : undefined);

  let lastSignature = "";
  let lastTimestamp = 0;

  const dispatchOnce = (event: NativeMediaActionEvent) => {
    if (!event?.action) return;
    const now = getNow();
    const sig = `${event.action}:${event.positionMs ?? -1}`;
    // Deduplicate dual delivery from Capacitor notifyListeners + DOM CustomEvent
    if (sig === lastSignature && now - lastTimestamp < 150) {
      return;
    }
    lastSignature = sig;
    lastTimestamp = now;
    handler(event);
  };

  let pluginSub: PluginListenerHandle | null = null;
  try {
    adapter.plugin
      .addListener("mediaAction", dispatchOnce)
      .then((sub) => {
        pluginSub = sub;
      })
      .catch(() => {});
  } catch {
    // Ignore if plugin not registered yet
  }

  const onDomAction = (e: Event) => {
    const detail = (e as CustomEvent<NativeMediaActionEvent>).detail;
    if (detail) dispatchOnce(detail);
  };
  target?.addEventListener("atlas:native-media-action", onDomAction);

  return () => {
    target?.removeEventListener("atlas:native-media-action", onDomAction);
    pluginSub?.remove().catch(() => {});
  };
}
