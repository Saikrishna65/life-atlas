"use client";

import React, { useEffect, useState, useRef } from "react";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
  X,
  Loader2,
  DownloadCloud,
  Moon,
  Gauge,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  Artwork,
  Equalizer,
  SpectrumBars,
  formatTime,
  gradientFor,
  hasLocalAudio,
  hasCloudCopy,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";
import { useMusicTheme } from "@/lib/music/theme";

const SLEEP_OPTIONS = [0, 15, 30, 45, 60] as const;

export default function NowPlayingModal() {
  useMusicTheme();
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    playbackRate,
    repeatMode,
    isShuffle,
    isNowPlayingOpen,
    sourceContext,
    queue,
    queueIndex,
    error,
    setIsNowPlayingOpen,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seek,
    setPlaybackRate,
    toggleShuffle,
    cycleRepeatMode,
    toggleFavorite,
    downloadTrack,
    playTrack,
    removeFromQueue,
  } = useMusicPlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepLabel, setSleepLabel] = useState<string | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const showQueueRef = useRef(showQueue);

  useEffect(() => {
    showQueueRef.current = showQueue;
  }, [showQueue]);

  // Handle Android Hardware / Gesture Back Navigation & browser popstate
  useEffect(() => {
    if (!isNowPlayingOpen) return;

    // Push modal state to history so Android back gesture or browser back stays inside Music Vault
    const modalState = { musicModal: "now-playing" };
    window.history.pushState(modalState, "");

    const onPopState = () => {
      if (showQueueRef.current) {
        setShowQueue(false);
      }
      setIsNowPlayingOpen(false);
    };
    window.addEventListener("popstate", onPopState);

    let appListenerHandle: PluginListenerHandle | null = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener("backButton", () => {
        if (showQueueRef.current) {
          setShowQueue(false);
          return;
        }
        if (typeof window !== "undefined" && window.history.state?.musicModal === "now-playing") {
          window.history.back();
        } else {
          setIsNowPlayingOpen(false);
        }
      })
        .then((h) => {
          appListenerHandle = h;
        })
        .catch(() => {});
    }

    return () => {
      appListenerHandle?.remove();
      window.removeEventListener("popstate", onPopState);
    };
  }, [isNowPlayingOpen, setIsNowPlayingOpen]);

  const handleMinimize = () => {
    triggerHaptic("tap");
    if (showQueue) {
      setShowQueue(false);
      return;
    }
    if (typeof window !== "undefined" && window.history.state?.musicModal === "now-playing") {
      window.history.back();
    } else {
      setIsNowPlayingOpen(false);
    }
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (deltaY > 60) {
      handleMinimize();
    }
    touchStartYRef.current = null;
  };

  useEffect(() => {
    if (!sleepEndsAt) {
      setSleepLabel(null);
      return;
    }
    const tick = () => {
      const remMs = sleepEndsAt - Date.now();
      if (remMs <= 0) {
        setSleepEndsAt(null);
        setSleepLabel(null);
        if (isPlaying) togglePlayPause();
      } else {
        setSleepLabel(`${Math.ceil(remMs / 60000)}m`);
      }
    };
    tick();
    const id = window.setInterval(tick, 10000);
    return () => window.clearInterval(id);
  }, [sleepEndsAt, isPlaying, togglePlayPause]);

  if (!isNowPlayingOpen || !currentTrack) return null;

  const total = duration || currentTrack.duration || 0;
  const pct = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;
  const local = hasLocalAudio(currentTrack);
  const canSave = !local && hasCloudCopy(currentTrack);

  const cycleSpeed = () => {
    triggerHaptic("tap");
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const i = speeds.indexOf(playbackRate);
    setPlaybackRate(speeds[(i + 1) % speeds.length]);
  };

  const cycleSleepTimer = () => {
    triggerHaptic("tap");
    if (!sleepEndsAt) {
      setSleepEndsAt(Date.now() + 15 * 60000);
      return;
    }
    const remMin = Math.round((sleepEndsAt - Date.now()) / 60000);
    const next = SLEEP_OPTIONS.find((m) => m > remMin + 2) ?? 0;
    setSleepEndsAt(next > 0 ? Date.now() + next * 60000 : null);
  };

  return (
    <div
      style={{ background: "var(--mv-bg)", color: "var(--mv-text)" }}
      className="music-theme fixed inset-0 z-50 flex flex-col select-none overflow-hidden animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
    >
      {/* Artwork-reactive blurred aura */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {currentTrack.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentTrack.artworkUrl}
            alt=""
            className="w-full h-full object-cover scale-125 blur-[85px] opacity-30"
          />
        ) : (
          <div
            style={{ background: "var(--mv-aura-1)" }}
            className="w-full h-full blur-3xl scale-125"
          />
        )}
        <div
          style={{
            background: "linear-gradient(to bottom, transparent 0%, var(--mv-bg) 82%)",
          }}
          className="absolute inset-0"
        />
      </div>

      {/* Top Drag Handle & Gesture Bar - generous padding clears selfie camera & punch holes */}
      <div
        onTouchStart={handleHeaderTouchStart}
        onTouchEnd={handleHeaderTouchEnd}
        className="relative z-20 pt-[max(env(safe-area-inset-top),3.25rem)] pb-2 flex justify-center cursor-pointer"
        onClick={handleMinimize}
        aria-label="Swipe or tap to minimize"
      >
        <div className="w-14 h-1.5 rounded-full bg-[var(--mv-border-strong)] active:scale-95 transition-transform opacity-75 hover:opacity-100 shadow-sm" />
      </div>

      {/* Top bar */}
      <header
        onTouchStart={handleHeaderTouchStart}
        onTouchEnd={handleHeaderTouchEnd}
        className="relative z-10 flex items-center justify-between px-4 pt-1 pb-2"
      >
        <button
          onClick={handleMinimize}
          className="w-11 h-11 rounded-full sonic-glass flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
          aria-label="Back to Music Vault"
        >
          <ChevronDown className="w-6 h-6 text-[var(--mv-text)]" />
        </button>
        <div className="text-center min-w-0 px-3">
          <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--mv-text-subtle)] font-semibold">
            Playing from
          </p>
          <p className="text-sm font-semibold text-[var(--mv-text)] truncate max-w-[200px]">
            {sourceContext?.title || "Your library"}
          </p>
        </div>
        <button
          onClick={() => {
            triggerHaptic("tap");
            setShowQueue((v) => !v);
          }}
          style={
            showQueue
              ? {
                  background: "var(--mv-primary-bg)",
                  color: "var(--mv-primary-fg)",
                }
              : undefined
          }
          className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
            showQueue ? "shadow-md" : "sonic-glass text-[var(--mv-text)]"
          }`}
          aria-label="Queue"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </header>

      {showQueue ? (
        /* Integrated Up-Next Queue */
        <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-5 pb-8">
          <div className="flex items-baseline justify-between px-1 mb-3">
            <h3 className="font-display text-2xl text-[var(--mv-text)]">Up next</h3>
            <span className="text-xs font-mono text-[var(--mv-text-muted)]">{queue.length} songs</span>
          </div>
          <div className="space-y-1">
            {queue.map((t, i) => {
              const active = i === queueIndex;
              return (
                <div
                  key={`${t.id}-${i}`}
                  className={`flex items-center gap-3 pl-2 pr-1 py-2 rounded-2xl ${
                    active ? "bg-[var(--mv-accent-soft)] border border-[var(--mv-border-strong)]" : ""
                  }`}
                >
                  <button
                    onClick={() => playTrack(t, queue, sourceContext)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <Artwork
                      track={t}
                      className="w-11 h-11 rounded-xl shrink-0"
                      iconClass="w-4 h-4"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm font-semibold truncate ${
                          active ? "text-[var(--mv-accent)]" : "text-[var(--mv-text)]"
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="block text-xs text-[var(--mv-text-muted)] truncate">{t.artist}</span>
                    </span>
                    {active && isPlaying && <Equalizer className="mr-2" />}
                  </button>
                  {!active && (
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--mv-text-subtle)] active:bg-[var(--mv-card-hover)] cursor-pointer"
                      aria-label="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {queue.length === 0 && (
              <p className="text-sm text-[var(--mv-text-muted)] p-4 text-center">The queue is empty.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col justify-end px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          {/* Hero Artwork + Vinyl Disc Halo */}
          <div className="flex-1 flex items-center justify-center py-4 min-h-0">
            <div
              className={`relative aspect-square w-full max-w-[300px] sm:max-w-[330px] transition-transform duration-700 ${
                isPlaying ? "scale-100" : "scale-[0.92]"
              }`}
            >
              <div
                style={{ background: "var(--mv-aura-1)" }}
                className="absolute inset-3 rounded-[40px] blur-2xl opacity-75"
                aria-hidden="true"
              />
              {/* Subtle vinyl disc peeking from right when playing */}
              <div
                className={`pointer-events-none absolute -right-4 top-5 bottom-5 aspect-square rounded-full vinyl-grooves border border-white/15 shadow-2xl transition-transform duration-700 flex items-center justify-center ${
                  isPlaying ? "translate-x-2 animate-vinyl opacity-90" : "-translate-x-6 opacity-0"
                }`}
                aria-hidden="true"
              >
                <div
                  className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradientFor(
                    currentTrack.id
                  )} border-4 border-[#090910]`}
                />
              </div>

              <Artwork
                track={currentTrack}
                className="relative z-10 w-full h-full rounded-[36px] shadow-[0_28px_65px_rgba(0,0,0,0.48)]"
                iconClass="w-1/4 h-1/4"
              />
            </div>
          </div>

          {/* Quality badge + Live Spectrum */}
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full sonic-glass text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--mv-text-muted)]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  local ? "bg-emerald-500" : "bg-sky-500"
                }`}
              />
              {local ? "Offline · Hi-Fi" : "Cloud Stream"}
            </span>
            <SpectrumBars playing={isPlaying} />
          </div>

          {/* Title + Actions */}
          <div className="flex items-center gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[26px] text-[var(--mv-text)] leading-tight truncate">
                {currentTrack.title}
              </h2>
              <p className="text-[var(--mv-text-muted)] truncate mt-0.5">
                {currentTrack.artist || "Unknown Artist"}
              </p>
            </div>
            {canSave && (
              <button
                onClick={() => downloadTrack(currentTrack)}
                className="w-11 h-11 rounded-full sonic-glass flex items-center justify-center active:scale-90 cursor-pointer"
                aria-label="Save to phone"
              >
                <DownloadCloud className="w-5 h-5 text-[var(--mv-text)]" />
              </button>
            )}
            <button
              onClick={() => toggleFavorite(currentTrack.id)}
              className="w-11 h-11 rounded-full sonic-glass flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              aria-label={currentTrack.isFavorite ? "Unlike" : "Like"}
            >
              <Heart
                className={`w-5 h-5 ${
                  currentTrack.isFavorite
                    ? "fill-[var(--mv-accent)] text-[var(--mv-accent)]"
                    : "text-[var(--mv-text)]"
                }`}
              />
            </button>
          </div>

          {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}

          {/* Tactile Scrubber */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={total || 100}
              step={0.1}
              value={Math.min(currentTime, total || 100)}
              onChange={(e) => seek(parseFloat(e.target.value))}
              aria-label="Seek"
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: "var(--mv-accent)",
                background: `linear-gradient(to right, var(--mv-accent) 0%, var(--mv-accent-2) ${pct}%, var(--mv-track) ${pct}%)`,
              }}
            />
            <div className="flex justify-between text-[11px] font-mono text-[var(--mv-text-subtle)] mt-1.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(total)}</span>
            </div>
          </div>

          {/* Primary Transport Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleShuffle}
              className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                isShuffle
                  ? "text-[var(--mv-accent)] bg-[var(--mv-accent-soft)]"
                  : "text-[var(--mv-text-subtle)]"
              }`}
              aria-label="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              onClick={previousTrack}
              className="w-14 h-14 rounded-full flex items-center justify-center text-[var(--mv-text)] active:scale-90 transition-transform cursor-pointer"
              aria-label="Previous"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>
            <button
              onClick={togglePlayPause}
              style={{
                background: "var(--mv-primary-bg)",
                color: "var(--mv-primary-fg)",
                boxShadow: "0 14px 40px -6px var(--mv-glow)",
              }}
              className="w-[76px] h-[76px] rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-9 h-9 fill-current" />
              ) : (
                <Play className="w-9 h-9 fill-current ml-1" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className="w-14 h-14 rounded-full flex items-center justify-center text-[var(--mv-text)] active:scale-90 transition-transform cursor-pointer"
              aria-label="Next"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
            <button
              onClick={cycleRepeatMode}
              className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                repeatMode !== "OFF"
                  ? "text-[var(--mv-accent)] bg-[var(--mv-accent-soft)]"
                  : "text-[var(--mv-text-subtle)]"
              }`}
              aria-label="Repeat"
            >
              {repeatMode === "ONE" ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Utility Pills: Speed + Sleep Timer + Queue */}
          <div className="flex items-center justify-center gap-2.5 mt-5">
            <button
              onClick={cycleSpeed}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full sonic-glass text-xs font-mono font-semibold text-[var(--mv-text-muted)] active:scale-95 cursor-pointer"
            >
              <Gauge className="w-3.5 h-3.5 text-[var(--mv-accent)]" />
              {playbackRate}×
            </button>

            <button
              onClick={cycleSleepTimer}
              style={
                sleepLabel
                  ? {
                      background: "var(--mv-accent-soft)",
                      borderColor: "var(--mv-border-strong)",
                      color: "var(--mv-accent)",
                    }
                  : undefined
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-mono font-semibold active:scale-95 cursor-pointer ${
                sleepLabel ? "" : "sonic-glass text-[var(--mv-text-muted)]"
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-[var(--mv-accent)]" />
              {sleepLabel ? `Sleep ${sleepLabel}` : "Sleep"}
            </button>

            <button
              onClick={() => setShowQueue(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full sonic-glass text-xs font-mono font-semibold text-[var(--mv-text-muted)] active:scale-95 cursor-pointer"
            >
              <ListMusic className="w-3.5 h-3.5 text-[var(--mv-accent)]" />
              Queue ({queue.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
