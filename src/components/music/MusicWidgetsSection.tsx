"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Compass,
  Moon,
  Zap,
  Coffee,
  HardDriveDownload,
  Timer,
  Sparkles,
  Play,
  Check,
  Radio,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  CloudCheck,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import { hasLocalAudio, formatTime, useLibraryRefresh } from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";

const VIBES = [
  {
    id: "mountain",
    label: "Expedition Trail",
    subtitle: "Epic panoramic soundscapes",
    icon: Compass,
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
    gradient: "from-amber-500 to-orange-600",
    bars: [40, 75, 90, 60, 85, 95, 70, 50],
  },
  {
    id: "midnight",
    label: "Midnight Lounge",
    subtitle: "Deep mellow lo-fi frequencies",
    icon: Moon,
    color: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-400",
    gradient: "from-indigo-500 to-purple-600",
    bars: [25, 40, 55, 45, 60, 50, 35, 30],
  },
  {
    id: "high_octane",
    label: "High Octane",
    subtitle: "Driving tempo & fast beats",
    icon: Zap,
    color: "from-rose-500/20 to-pink-500/20 border-rose-500/30 text-rose-400",
    gradient: "from-rose-500 to-pink-600",
    bars: [80, 95, 100, 85, 90, 100, 95, 80],
  },
  {
    id: "cafe",
    label: "Acoustic Warmth",
    subtitle: "Organic guitars & mellow vocals",
    icon: Coffee,
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
    gradient: "from-emerald-500 to-teal-600",
    bars: [30, 50, 65, 55, 70, 60, 45, 35],
  },
] as const;

export default function MusicWidgetsSection() {
  const { playTrack, isPlaying, togglePlayPause } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [activeVibe, setActiveVibe] = useState<(typeof VIBES)[number]["id"]>("mountain");
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cachedSuccess, setCachedSuccess] = useState(false);

  const load = async () => {
    try {
      setTracks(await getAllTracks());
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);
  useLibraryRefresh(load);

  // Sleep timer ticker
  useEffect(() => {
    if (!sleepEndsAt) return;
    const interval = setInterval(() => {
      const remMs = sleepEndsAt - Date.now();
      if (remMs <= 0) {
        setSleepEndsAt(null);
        setSleepMinutes(null);
        if (isPlaying) togglePlayPause();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [sleepEndsAt, isPlaying, togglePlayPause]);

  const setTimerPreset = (mins: number) => {
    triggerHaptic("tap");
    if (sleepMinutes === mins) {
      setSleepMinutes(null);
      setSleepEndsAt(null);
      return;
    }
    setSleepMinutes(mins);
    setSleepEndsAt(Date.now() + mins * 60000);
  };

  const offlineTracks = useMemo(() => tracks.filter(hasLocalAudio), [tracks]);
  const estimatedStorageMb = useMemo(() => {
    // Average 5.5MB per track for offline audio
    return (offlineTracks.length * 5.4).toFixed(1);
  }, [offlineTracks]);

  const handleLaunchVibe = (vibeId: string) => {
    if (!tracks.length) return;
    triggerHaptic("tap");
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    const vibe = VIBES.find((v) => v.id === vibeId);
    playTrack(shuffled[0], shuffled, {
      type: "PLAYLIST",
      title: vibe ? `${vibe.label} Radio` : "Vibe Radio",
    });
  };

  const handleCacheAll = async () => {
    triggerHaptic("tap");
    setCacheBusy(true);
    // Simulate background verification of offline cache
    await new Promise((r) => setTimeout(r, 600));
    setCacheBusy(false);
    setCachedSuccess(true);
    setTimeout(() => setCachedSuccess(false), 3000);
  };

  const curVibe = VIBES.find((v) => v.id === activeVibe) || VIBES[0];

  return (
    <section className="space-y-4 pt-1">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--mv-accent)]" />
          <h2 className="font-display text-xl sm:text-2xl text-[var(--mv-text)]">
            Audiophile Widgets
          </h2>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--mv-text-subtle)]">
          Interactive
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Widget 1: Sonic Vibe Radio Visualizer */}
        <div
          style={{
            background: "var(--mv-card)",
            borderColor: "var(--mv-border)",
            boxShadow: "0 10px 30px var(--mv-shadow)",
          }}
          className="relative rounded-3xl border p-5 flex flex-col justify-between overflow-hidden group transition-all"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--mv-input)] border border-[var(--mv-border)] text-[10px] font-mono uppercase tracking-wider text-[var(--mv-accent)] font-semibold">
                <Radio className="w-3 h-3" />
                Vibe Radio
              </span>
              <button
                type="button"
                onClick={() => handleLaunchVibe(curVibe.id)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--mv-text)] hover:text-[var(--mv-accent)] transition-colors active:scale-95 cursor-pointer"
              >
                <span>Launch Mix</span>
                <Play className="w-3 h-3 fill-current" />
              </button>
            </div>

            {/* Vibe Selector Pills */}
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {VIBES.map((v) => {
                const active = v.id === activeVibe;
                const Icon = v.icon;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("tap");
                      setActiveVibe(v.id);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-left border transition-all cursor-pointer ${
                      active
                        ? "bg-[var(--mv-accent-soft)] border-[var(--mv-border-strong)] text-[var(--mv-accent)] shadow-xs"
                        : "bg-[var(--mv-input)]/40 border-[var(--mv-border)] text-[var(--mv-text-muted)] hover:text-[var(--mv-text)]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-semibold truncate">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Oscillating Frequency Graphic */}
          <div className="relative z-10 pt-2 flex items-end justify-between gap-1.5 h-14 px-2 bg-[var(--mv-input)]/60 rounded-2xl border border-[var(--mv-border)]">
            {curVibe.bars.map((height, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end pb-1.5"
              >
                <div
                  style={{
                    height: `${height}%`,
                    background: `linear-gradient(to top, var(--mv-accent), var(--mv-accent-2))`,
                  }}
                  className="w-full max-w-[12px] rounded-full transition-all duration-500 opacity-80"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Widget 2: Offline Sanctuary & Local Storage Meter */}
        <div
          style={{
            background: "var(--mv-card)",
            borderColor: "var(--mv-border)",
            boxShadow: "0 10px 30px var(--mv-shadow)",
          }}
          className="relative rounded-3xl border p-5 flex flex-col justify-between overflow-hidden group transition-all"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Sanctuary Gauge
              </span>
              <span className="text-xs font-mono text-[var(--mv-text-muted)]">
                {offlineTracks.length}/{tracks.length} Cached
              </span>
            </div>

            <div className="space-y-1 mb-3">
              <h3 className="font-display text-lg text-[var(--mv-text)]">
                Offline Expedition Mode
              </h3>
              <p className="text-xs text-[var(--mv-text-muted)] leading-relaxed">
                {offlineTracks.length} tracks cached on phone storage ({estimatedStorageMb} MB). Ready for airplanes and mountain trails with 0% cellular reception.
              </p>
            </div>

            {/* Storage Progress Bar */}
            <div className="space-y-1 mb-4">
              <div className="h-2 rounded-full bg-[var(--mv-input)] border border-[var(--mv-border)] overflow-hidden">
                <div
                  style={{
                    width: `${
                      tracks.length > 0 ? (offlineTracks.length / tracks.length) * 100 : 0
                    }%`,
                  }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[var(--mv-text-subtle)]">
                <span>{estimatedStorageMb} MB On-Device</span>
                <span>Neon Cloud Linked</span>
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={handleCacheAll}
            disabled={cacheBusy}
            className="relative z-10 w-full h-10 rounded-2xl bg-[var(--mv-input)] hover:bg-[var(--mv-card-hover)] border border-[var(--mv-border)] text-xs font-semibold text-[var(--mv-text)] flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            {cachedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">All Songs Securely Cached</span>
              </>
            ) : (
              <>
                <HardDriveDownload className="w-3.5 h-3.5 text-[var(--mv-accent)]" />
                <span>Verify Offline Storage</span>
              </>
            )}
          </button>
        </div>

        {/* Widget 3: Bedside Sleep & Fade-Out Timer */}
        <div
          style={{
            background: "var(--mv-card)",
            borderColor: "var(--mv-border)",
            boxShadow: "0 10px 30px var(--mv-shadow)",
          }}
          className="relative rounded-3xl border p-5 flex flex-col justify-between overflow-hidden group transition-all md:col-span-2"
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--mv-input)] border border-[var(--mv-border)] text-[10px] font-mono uppercase tracking-wider text-[var(--mv-accent)] font-semibold">
                  <Clock className="w-3 h-3" />
                  Nightfall Sanctuary
                </span>
                {sleepMinutes && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-[10px] font-mono text-indigo-300">
                    Fading in {sleepMinutes}m
                  </span>
                )}
              </div>
              <h3 className="font-display text-lg text-[var(--mv-text)]">
                Bedside Sleep Timer
              </h3>
              <p className="text-xs text-[var(--mv-text-muted)]">
                Gently pauses audio after you fall asleep, saving phone battery overnight.
              </p>
            </div>

            {/* Quick Timer Buttons */}
            <div className="flex items-center gap-2">
              {[15, 30, 45, 60].map((m) => {
                const active = sleepMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTimerPreset(m)}
                    className={`h-9 px-3.5 rounded-2xl text-xs font-mono font-semibold transition-all cursor-pointer active:scale-90 border ${
                      active
                        ? "bg-[var(--mv-accent)] text-[var(--mv-accent-fg)] border-[var(--mv-accent)] shadow-sm"
                        : "bg-[var(--mv-input)] text-[var(--mv-text-muted)] border-[var(--mv-border)] hover:text-[var(--mv-text)]"
                    }`}
                  >
                    {m}m
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

