/**
 * Life Atlas: Music Vault Background Media Bridge & Multi-Palette Theme Test Suite
 * Validates 4-palette theme persistence/DOM attribute sync and native Android
 * foreground MediaPlayback bridge payload normalization & dual-channel action deduplication.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  MUSIC_THEMES,
  MusicThemeId,
  getSavedMusicTheme,
  setSavedMusicTheme,
  applyMusicThemeAttribute,
} from "@/lib/music/theme";
import {
  resolveArtworkUrl,
  syncNativeMediaPlayback,
  stopNativeMediaPlayback,
  subscribeNativeMediaActions,
  NativeBridgeAdapter,
  NativeMediaActionEvent,
  NativePlaybackPayload,
} from "@/lib/music/nativeMediaBridge";

describe("Music Vault Multi-Palette Theme System & Native Media Bridge", () => {
  describe("1. Multi-Palette Color Theme System", () => {
    test("defines all four palettes (Champagne Gold, Deep Emerald, Arctic Cyan, Alabaster Glass)", () => {
      const ids = MUSIC_THEMES.map((t) => t.id);
      assert.deepEqual(ids, ["gold", "emerald", "cyan", "alabaster"]);
      assert.equal(MUSIC_THEMES.find((t) => t.id === "alabaster")?.isLight, true);
      for (const option of MUSIC_THEMES) {
        assert.equal(option.swatches.length, 3);
        assert.ok(option.name.length > 0);
        assert.ok(option.subtitle.length > 0);
      }
    });

    test("persists selected theme in localStorage and syncs html[data-music-theme]", () => {
      const store = new Map<string, string>();
      const dispatched: string[] = [];
      const dataset: Record<string, string> = {};

      const prevWindow = (globalThis as Record<string, unknown>).window;
      const prevDoc = (globalThis as Record<string, unknown>).document;

      try {
        (globalThis as Record<string, unknown>).window = {
          localStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => store.set(k, v),
          },
          dispatchEvent: (ev: Event) => {
            dispatched.push(ev.type);
            return true;
          },
        };
        (globalThis as Record<string, unknown>).document = {
          documentElement: { dataset },
        };

        // Defaults to Champagne Gold when unset or invalid
        assert.equal(getSavedMusicTheme(), "gold");
        store.set("atlas_music_theme", "unknown_neon_pink");
        assert.equal(getSavedMusicTheme(), "gold");

        // Switches cleanly across all 4 supported palettes
        const palettes: MusicThemeId[] = ["emerald", "cyan", "alabaster", "gold"];
        for (const palette of palettes) {
          setSavedMusicTheme(palette);
          assert.equal(getSavedMusicTheme(), palette);
          assert.equal(dataset.musicTheme, palette);
        }

        applyMusicThemeAttribute("alabaster");
        assert.equal(dataset.musicTheme, "alabaster");
        assert.equal(dispatched.length, 4);
      } finally {
        if (prevWindow === undefined) {
          delete (globalThis as Record<string, unknown>).window;
        } else {
          (globalThis as Record<string, unknown>).window = prevWindow;
        }
        if (prevDoc === undefined) {
          delete (globalThis as Record<string, unknown>).document;
        } else {
          (globalThis as Record<string, unknown>).document = prevDoc;
        }
      }
    });
  });

  describe("2. Native Android MediaPlayback Foreground Service Bridge", () => {
    test("normalizes artwork URLs for native Android notification decoder", () => {
      assert.equal(
        resolveArtworkUrl("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"),
        "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      );
      assert.equal(
        resolveArtworkUrl("data:image/jpeg;base64,/9j/4AAQ"),
        "data:image/jpeg;base64,/9j/4AAQ"
      );
      assert.equal(
        resolveArtworkUrl("/icons/cover.png", "https://life-atlas-eight-five.vercel.app"),
        "https://life-atlas-eight-five.vercel.app/icons/cover.png"
      );
      // WebView-only blob: URLs cannot be opened by Java HttpURLConnection; fallback cleanly to ""
      assert.equal(resolveArtworkUrl("blob:https://life-atlas/1234"), "");
      assert.equal(resolveArtworkUrl(undefined), "");
    });

    test("syncs playback state to native Android service and gracefully no-ops on web", () => {
      const updates: NativePlaybackPayload[] = [];
      let stops = 0;

      const makeAdapter = (android: boolean): NativeBridgeAdapter => ({
        isAndroidNative: () => android,
        origin: "https://life-atlas-eight-five.vercel.app",
        plugin: {
          updatePlayback: async (opts) => {
            updates.push(opts);
          },
          stopPlayback: async () => {
            stops++;
          },
          addListener: async () => ({ remove: async () => {} }),
        },
      });

      // Web browser -> graceful no-op
      syncNativeMediaPlayback(
        {
          title: "Midnight City",
          artist: "M83",
          album: "Hurry Up, We're Dreaming",
          isPlaying: true,
          positionMs: 12450.7,
          durationMs: 243900.2,
          playbackRate: 1,
        },
        makeAdapter(false)
      );
      stopNativeMediaPlayback(makeAdapter(false));
      assert.equal(updates.length, 0);
      assert.equal(stops, 0);

      // Android native -> sanitized & forwarded to Foreground MediaPlaybackService
      syncNativeMediaPlayback(
        {
          title: "",
          artist: "",
          album: "",
          artworkUrl: "/cover.jpg",
          isPlaying: true,
          positionMs: -15,
          durationMs: 185432.6,
          playbackRate: 1.25,
        },
        makeAdapter(true)
      );
      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0], {
        title: "Atlas Music Vault",
        artist: "Life Atlas",
        album: "Music Vault",
        artworkUrl: "https://life-atlas-eight-five.vercel.app/cover.jpg",
        isPlaying: true,
        positionMs: 0,
        durationMs: 185433,
        playbackRate: 1.25,
      });

      stopNativeMediaPlayback(makeAdapter(true));
      assert.equal(stops, 1);
    });

    test("deduplicates dual Capacitor + DOM lock-screen media actions within 150ms", async () => {
      let currentNow = 10_000;
      const pluginListeners: Array<(ev: NativeMediaActionEvent) => void> = [];
      let pluginRemoved = false;
      const domListeners = new Map<string, EventListener>();

      const adapter: NativeBridgeAdapter = {
        isAndroidNative: () => true,
        now: () => currentNow,
        eventTarget: {
          addEventListener: (name: string, fn: EventListenerOrEventListenerObject) => {
            domListeners.set(name, fn as EventListener);
          },
          removeEventListener: (name: string) => {
            domListeners.delete(name);
          },
        },
        plugin: {
          updatePlayback: async () => {},
          stopPlayback: async () => {},
          addListener: async (_eventName, listenerFunc) => {
            pluginListeners.push(listenerFunc);
            return {
              remove: async () => {
                pluginRemoved = true;
              },
            };
          },
        },
      };

      const received: NativeMediaActionEvent[] = [];
      const unsubscribe = subscribeNativeMediaActions((ev) => received.push(ev), adapter);
      // Flush microtask for addListener promise
      await Promise.resolve();

      assert.equal(pluginListeners.length, 1);
      const firePlugin = pluginListeners[0];
      assert.ok(domListeners.has("atlas:native-media-action"));

      const fireDom = (detail: NativeMediaActionEvent) => {
        const fn = domListeners.get("atlas:native-media-action");
        fn?.({ detail } as unknown as Event);
      };

      // Dual delivery of "next" 20ms apart -> received ONCE
      firePlugin({ action: "next" });
      currentNow += 20;
      fireDom({ action: "next" });
      assert.equal(received.length, 1);
      assert.equal(received[0].action, "next");

      // Different action ("pause") immediately after -> received!
      currentNow += 10;
      firePlugin({ action: "pause" });
      assert.equal(received.length, 2);
      assert.equal(received[1].action, "pause");

      // Same action ("pause") after 200ms -> received again!
      currentNow += 200;
      fireDom({ action: "pause" });
      assert.equal(received.length, 3);

      // Seek action carries positionMs accurately
      currentNow += 10;
      firePlugin({ action: "seek", positionMs: 42000 });
      currentNow += 15;
      fireDom({ action: "seek", positionMs: 42000 });
      assert.equal(received.length, 4);
      assert.equal(received[3].positionMs, 42000);

      // Cleanup unsubscribes both channels
      unsubscribe();
      assert.equal(domListeners.has("atlas:native-media-action"), false);
      assert.equal(pluginRemoved, true);
    });
  });
});
