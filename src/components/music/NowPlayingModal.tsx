"use client";

import React, { useEffect, useState, useRef } from "react";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
  ChevronLeft,
  Upload,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  X,
  Loader2,
  DownloadCloud,
  Moon,
  Gauge,
  Music,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  Artwork,
  Equalizer,
  formatTime,
  gradientFor,
  hasLocalAudio,
  hasCloudCopy,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";
import { useMusicTheme } from "@/lib/music/theme";

const SLEEP_OPTIONS = [0, 15, 30, 45, 60] as const;
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

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
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepLabel, setSleepLabel] = useState<string | null>(null);

  // Scrubber drag state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const showQueueRef = useRef(showQueue);
  const showSettingsRef = useRef(showSettings);
  useEffect(() => {
    showQueueRef.current = showQueue;
  }, [showQueue]);
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Handle Android Hardware / Gesture Back Navigation & browser popstate
  useEffect(() => {
    if (!isNowPlayingOpen) return;

    const modalState = { musicModal: "now-playing" };
    window.history.pushState(modalState, "");

    const onPopState = () => {
      if (showQueueRef.current) {
        setShowQueue(false);
        return;
      }
      if (showSettingsRef.current) {
        setShowSettings(false);
        return;
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
        if (showSettingsRef.current) {
          setShowSettings(false);
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
    if (showSettings) {
      setShowSettings(false);
      return;
    }
    if (typeof window !== "undefined" && window.history.state?.musicModal === "now-playing") {
      window.history.back();
    } else {
      setIsNowPlayingOpen(false);
    }
  };

  // Sleep timer ticker
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
  const activeTime = isScrubbing ? scrubTime : currentTime;
  const pct = total > 0 ? Math.min(100, Math.max(0, (activeTime / total) * 100)) : 0;
  const local = hasLocalAudio(currentTrack);
  const canSave = !local && hasCloudCopy(currentTrack);

  const calculateTimeFromEvent = (clientX: number) => {
    if (!scrubberRef.current) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pos * total;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(true);
    const newTime = calculateTimeFromEvent(e.clientX);
    setScrubTime(newTime);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    const newTime = calculateTimeFromEvent(e.clientX);
    setScrubTime(newTime);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    const newTime = calculateTimeFromEvent(e.clientX);
    seek(newTime);
    setIsScrubbing(false);
  };

  const handleShare = async () => {
    triggerHaptic("tap");
    const shareText = `${currentTrack.title} — ${currentTrack.artist || "Unknown Artist"}`;
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ title: currentTrack.title, text: shareText })) {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: shareText,
        });
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      showToast("Track details copied to clipboard");
    } catch {
      showToast("Sharing not supported on this device");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#070709] text-white select-none overflow-hidden animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1c1e]/95 backdrop-blur-md border border-white/10 text-xs font-semibold text-white shadow-2xl animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Main Screen: Exact layout matching the requested design */}
      <div className="relative flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
        {/* Upper Hero Artwork Section (Full-bleed with subtle top/bottom gradients) */}
        <div className="relative flex-1 w-full min-h-0 overflow-hidden">
          {/* Blurred Background Glow */}
          {currentTrack.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentTrack.artworkUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-40 pointer-events-none"
              aria-hidden="true"
            />
          ) : (
            <div
              className={`absolute inset-0 w-full h-full bg-gradient-to-b ${gradientFor(
                currentTrack.id || currentTrack.title
              )} blur-3xl opacity-35 pointer-events-none`}
              aria-hidden="true"
            />
          )}

          {/* Foreground Hero Artwork */}
          <div className="absolute inset-0 flex items-center justify-center">
            {currentTrack.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover object-center"
                draggable={false}
              />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-br ${gradientFor(
                  currentTrack.id || currentTrack.title
                )} flex items-center justify-center`}
              >
                <Music className="w-24 h-24 text-white/30" />
              </div>
            )}
          </div>

          {/* Smooth Dark Vignette / Bottom Gradient to seamlessly merge into the black control area */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.2) 65%, rgba(7,7,9,0.85) 88%, #070709 100%)",
            }}
            aria-hidden="true"
          />

          {/* Top Bar Buttons: Back `<` on left, Share on right */}
          <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
            <button
              onClick={handleMinimize}
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer shadow-lg hover:bg-black/55"
              aria-label="Back to Music Vault"
            >
              <ChevronLeft className="w-5 h-5 text-white stroke-[2.5]" />
            </button>

            <button
              onClick={handleShare}
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer shadow-lg hover:bg-black/55"
              aria-label="Share track"
            >
              <Upload className="w-5 h-5 text-white" />
            </button>
          </header>
        </div>

        {/* Lower Controls Section: Exact matching components */}
        <div className="relative z-10 w-full px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2 space-y-4 shrink-0 bg-[#070709]">
          {/* Row 1: Track Information (Left) + Floating Action Buttons (Right) */}
          <div className="flex items-end justify-between gap-4">
            {/* Left: Track Title & Artist */}
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight truncate drop-shadow-md">
                {currentTrack.title}
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 font-medium truncate mt-1">
                {currentTrack.artist || "Unknown Artist"}
              </p>
            </div>

            {/* Right: 3 Circular Buttons Stack */}
            <div className="flex flex-col gap-2.5 items-center shrink-0">
              {/* Button 1 (Top): Equalizer / Audio Settings */}
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  setShowSettings((v) => !v);
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-lg border border-white/10 ${
                  showSettings ? "bg-[#f95721] text-black" : "bg-[#1c1c1e]/90 backdrop-blur-md text-[#f95721] hover:bg-[#28282c]"
                }`}
                aria-label="Playback speed and audio settings"
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>

              {/* Button 2 (Middle): Lyrics / Queue */}
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  setShowQueue((v) => !v);
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-lg border border-white/10 ${
                  showQueue ? "bg-[#f95721] text-black" : "bg-[#1c1c1e]/90 backdrop-blur-md text-[#f95721] hover:bg-[#28282c]"
                }`}
                aria-label="Up next queue"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="16" height="14" rx="4" />
                  <line x1="7" y1="11" x2="13" y2="11" />
                  <line x1="7" y1="15" x2="15" y2="15" />
                  <path d="M19 3v4M21 5h-4" />
                </svg>
              </button>

              {/* Button 3 (Bottom): Orange 3D Cube (Favorites & Spatial Audio) */}
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  toggleFavorite(currentTrack.id);
                  showToast(currentTrack.isFavorite ? "Removed from Favorites" : "Added to Favorites ❤️");
                }}
                className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-[0_4px_22px_rgba(249,87,33,0.5)] ${
                  currentTrack.isFavorite
                    ? "bg-[#ff6835] ring-2 ring-white/30"
                    : "bg-[#f95721] hover:brightness-110"
                }`}
                aria-label={currentTrack.isFavorite ? "Favorited song" : "Add to favorites"}
                title={currentTrack.isFavorite ? "Favorited" : "Add to favorites"}
              >
                <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                  <circle cx="16.5" cy="15.5" r="1.5" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          {/* Row 2: Capsule Scrubber Bar */}
          <div className="w-full bg-[#18181a] border border-white/5 rounded-xl h-9 px-3.5 flex items-center justify-between gap-3 shadow-inner">
            <span className="text-[11px] font-mono font-medium text-zinc-400 select-none shrink-0 w-8 text-left">
              {formatTime(activeTime)}
            </span>

            {/* Interactive Scrubber Bar */}
            <div
              ref={scrubberRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative flex-1 h-6 flex items-center cursor-pointer touch-none"
            >
              {/* Background Track Rail */}
              <div className="w-full h-1 bg-zinc-700/60 rounded-full overflow-hidden">
                {/* Played Progress Line */}
                <div
                  className="h-full bg-[#f95721] rounded-full transition-[width] duration-75"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Vertical Orange Pill Slider Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-3.5 bg-[#f95721] rounded-[2px] shadow-[0_0_8px_rgba(249,87,33,0.9)] pointer-events-none transition-[left] duration-75"
                style={{ left: `${pct}%` }}
              />
            </div>

            <span className="text-[11px] font-mono font-medium text-zinc-400 select-none shrink-0 w-8 text-right">
              {formatTime(total)}
            </span>
          </div>

          {/* Row 3: Bottom Transport Controls (3 Large Charcoal Circles with Vibrant Orange Icons) */}
          <div className="flex items-center justify-center gap-3.5 sm:gap-4 pt-1">
            {/* Previous Track */}
            <button
              onClick={() => {
                triggerHaptic("tap");
                previousTrack();
              }}
              className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-full bg-[#18181a] border border-white/[0.06] flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-lg hover:bg-[#202024]"
              aria-label="Previous track"
            >
              <SkipBack className="w-7 h-7 sm:w-8 sm:h-8 fill-[#f95721] text-[#f95721]" />
            </button>

            {/* Play / Pause (Center, Slightly Larger) */}
            <button
              onClick={() => {
                triggerHaptic("tap");
                togglePlayPause();
              }}
              className="w-[86px] h-[86px] sm:w-[98px] sm:h-[98px] rounded-full bg-[#18181a] border border-white/[0.06] flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xl hover:bg-[#202024]"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isBuffering ? (
                <Loader2 className="w-9 h-9 sm:w-10 sm:h-10 text-[#f95721] animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-9 h-9 sm:w-10 sm:h-10 fill-[#f95721] text-[#f95721]" />
              ) : (
                <Play className="w-9 h-9 sm:w-10 sm:h-10 fill-[#f95721] text-[#f95721] ml-1" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={() => {
                triggerHaptic("tap");
                nextTrack();
              }}
              className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-full bg-[#18181a] border border-white/[0.06] flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-lg hover:bg-[#202024]"
              aria-label="Next track"
            >
              <SkipForward className="w-7 h-7 sm:w-8 sm:h-8 fill-[#f95721] text-[#f95721]" />
            </button>
          </div>
        </div>
      </div>

      {/* Up Next Queue Slide-over Sheet */}
      {showQueue && (
        <div className="absolute inset-0 z-40 flex flex-col bg-[#070709]/95 backdrop-blur-xl animate-fade-in">
          <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-4 border-b border-white/10">
            <div>
              <h2 className="text-xl font-bold text-white">Up next</h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{queue.length} songs in queue</p>
            </div>
            <button
              onClick={() => setShowQueue(false)}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
              aria-label="Close queue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {queue.map((t, i) => {
              const active = i === queueIndex;
              return (
                <div
                  key={`${t.id}-${i}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${
                    active
                      ? "bg-white/10 border border-[#f95721]/30 shadow-md"
                      : "hover:bg-white/5"
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
                          active ? "text-[#f95721]" : "text-white"
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="block text-xs text-zinc-400 truncate mt-0.5">{t.artist}</span>
                    </span>
                    {active && isPlaying && <Equalizer className="mr-2" />}
                  </button>
                  {!active && (
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white active:bg-white/10 cursor-pointer"
                      aria-label="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {queue.length === 0 && (
              <p className="text-sm text-zinc-400 p-8 text-center">The queue is currently empty.</p>
            )}
          </div>
        </div>
      )}

      {/* Audio Settings & Playback Controls Sheet */}
      {showSettings && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowSettings(false)}>
          <div
            className="w-full bg-[#141416] border-t border-white/10 rounded-t-3xl p-5 space-y-5 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#f95721]" />
                <h3 className="text-base font-bold text-white">Audio &amp; Playback</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Playback Speed */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#f95721]" />
                Playback Speed
              </label>
              <div className="grid grid-cols-5 gap-2">
                {SPEED_OPTIONS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      triggerHaptic("tap");
                      setPlaybackRate(speed);
                    }}
                    className={`py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                      playbackRate === speed
                        ? "bg-[#f95721] text-black shadow-md font-bold"
                        : "bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep Timer */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-[#f95721]" />
                Sleep Timer {sleepLabel && <span className="text-[#f95721]">({sleepLabel} remaining)</span>}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {SLEEP_OPTIONS.map((mins) => {
                  const active = mins === 0 ? !sleepEndsAt : (sleepEndsAt !== null && Math.round((sleepEndsAt - Date.now()) / 60000) === mins);
                  return (
                    <button
                      key={mins}
                      onClick={() => {
                        triggerHaptic("tap");
                        if (mins === 0) {
                          setSleepEndsAt(null);
                          setSleepLabel(null);
                        } else {
                          setSleepEndsAt(Date.now() + mins * 60000);
                          setSleepLabel(`${mins}m`);
                        }
                      }}
                      className={`py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                        active
                          ? "bg-[#f95721] text-black shadow-md font-bold"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {mins === 0 ? "Off" : `${mins}m`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modes: Shuffle & Repeat & Offline Save */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  toggleShuffle();
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                  isShuffle
                    ? "bg-[#f95721]/20 border-[#f95721] text-[#f95721]"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic("tap");
                  cycleRepeatMode();
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                  repeatMode !== "OFF"
                    ? "bg-[#f95721]/20 border-[#f95721] text-[#f95721]"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                {repeatMode === "ONE" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                <span>{repeatMode === "ONE" ? "Repeat 1" : repeatMode === "ALL" ? "Repeat All" : "Repeat"}</span>
              </button>

              {canSave ? (
                <button
                  onClick={() => {
                    triggerHaptic("tap");
                    downloadTrack(currentTrack);
                    showToast("Saving track to phone...");
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-white/5 bg-white/5 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  <DownloadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Download</span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-white/5 bg-white/5 text-zinc-500 text-[11px] font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${local ? "bg-emerald-500" : "bg-sky-500"}`} />
                  <span>{local ? "Offline" : "Cloud"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
