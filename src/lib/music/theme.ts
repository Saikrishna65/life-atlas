"use client";

import { useState, useEffect, useCallback } from "react";
import { syncNativeTheme } from "./nativeMediaBridge";

export type MusicThemeId = "gold" | "emerald" | "cyan" | "alabaster";

export interface MusicThemeOption {
  id: MusicThemeId;
  name: string;
  subtitle: string;
  isLight?: boolean;
  swatches: [string, string, string];
}

export const MUSIC_THEMES: MusicThemeOption[] = [
  {
    id: "gold",
    name: "Champagne Gold",
    subtitle: "Midnight slate & warm brushed gold",
    swatches: ["#0b0d12", "#1c202b", "#e5b869"],
  },
  {
    id: "emerald",
    name: "Deep Emerald",
    subtitle: "Matte graphite & crisp studio mint",
    swatches: ["#090d0b", "#15231b", "#1ed760"],
  },
  {
    id: "cyan",
    name: "Arctic Cyan",
    subtitle: "Abyssal navy & electric ice-blue",
    swatches: ["#070c14", "#102033", "#38bdf8"],
  },
  {
    id: "alabaster",
    name: "Alabaster Glass",
    subtitle: "Frosted ivory & crimson coral",
    isLight: true,
    swatches: ["#f6f6f9", "#ffffff", "#f43f5e"],
  },
];

const STORAGE_KEY = "atlas_music_theme";
const EVENT_NAME = "atlas_music_theme_changed";

export function getSavedMusicTheme(): MusicThemeId {
  if (typeof window === "undefined") return "gold";
  try {
    const val = window.localStorage.getItem(STORAGE_KEY) as MusicThemeId | null;
    if (val && MUSIC_THEMES.some((t) => t.id === val)) {
      return val;
    }
  } catch {
    // Ignore storage read errors
  }
  return "gold";
}

export function applyMusicThemeAttribute(theme: MusicThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.musicTheme = theme;
}

export function setSavedMusicTheme(theme: MusicThemeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage write errors
  }
  applyMusicThemeAttribute(theme);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: theme }));
  syncNativeTheme(theme);
}

export function useMusicTheme(): {
  theme: MusicThemeId;
  setTheme: (next: MusicThemeId) => void;
  currentOption: MusicThemeOption;
} {
  const [theme, setThemeState] = useState<MusicThemeId>(() => getSavedMusicTheme());

  useEffect(() => {
    const initial = getSavedMusicTheme();
    setThemeState(initial);
    applyMusicThemeAttribute(initial);

    const onThemeChanged = () => {
      const updated = getSavedMusicTheme();
      setThemeState(updated);
      applyMusicThemeAttribute(updated);
    };

    window.addEventListener(EVENT_NAME, onThemeChanged);
    window.addEventListener("storage", onThemeChanged);
    return () => {
      window.removeEventListener(EVENT_NAME, onThemeChanged);
      window.removeEventListener("storage", onThemeChanged);
    };
  }, []);

  const setTheme = useCallback((next: MusicThemeId) => {
    setThemeState(next);
    setSavedMusicTheme(next);
  }, []);

  const currentOption = MUSIC_THEMES.find((t) => t.id === theme) || MUSIC_THEMES[0];

  return { theme, setTheme, currentOption };
}

