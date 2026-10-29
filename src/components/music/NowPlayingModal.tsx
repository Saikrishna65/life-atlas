"use client";

import React, { useEffect, useState } from "react";
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

const SLEEP_OPTIONS = [0, 15, 30, 45, 60] as const;

export default function NowPlayingModal() {
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
      className="sonic-dark fixed inset-0 z-50 bg-[#05050a] text-white flex flex-col select-none overflow-hidden animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
    >
      {/* Artwork-reactive blurred aurora */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {currentTrack.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentTrack.artworkUrl}
            alt=""
            className="w-full h-full object-cover scale-125 blur-[80px] opacity-50"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradientFor(
              currentTrack.id
            )} opacity-40 blur-3xl scale-125`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-[#05050a]/75 to-[#05050a]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          onClick={() => setIsNowPlayingOpen(false)}
          className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
          aria-label="Minimize"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="text-center min-w-0 px-3">
          <p className="text-[10px] tracking-[0.22em] uppercase text-white/45 font-semibold">
            Playing from
          </p>
          <p className="text-sm font-semibold text-white truncate max-w-[200px]">
            {sourceContext?.title || "Your library"}
          </p>
        </div>
        <button
          onClick={() => {
            triggerHaptic("tap");
            setShowQueue((v) => !v);
          }}
          className={`w-11 h-11 rounded-full border flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
            showQueue
              ? "bg-white text-black border-white"
              : "bg-white/10 border-white/10 text-white"
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
            <h3 className="font-display text-2xl text-white">Up next</h3>
            <span className="text-xs font-mono text-white/45">{queue.length} songs</span>
          </div>
          <div className="space-y-1">
            {queue.map((t, i) => {
              const active = i === queueIndex;
              return (
                <div
                  key={`${t.id}-${i}`}
                  className={`flex items-center gap-3 pl-2 pr-1 py-2 rounded-2xl ${
                    active ? "bg-white/12 border border-white/10" : ""
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
                          active ? "text-fuchsia-300" : "text-white"
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="block text-xs text-white/45 truncate">{t.artist}</span>
                    </span>
                    {active && isPlaying && <Equalizer className="mr-2" />}
                  </button>
                  {!active && (
                    <button
                      onClick={() => removeFromQueue(i)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white/35 active:bg-white/10 cursor-pointer"
                      aria-label="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {queue.length === 0 && (
              <p className="text-sm text-white/40 p-4 text-center">The queue is empty.</p>
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
                className={`absolute inset-3 rounded-[40px] bg-gradient-to-br ${gradientFor(
                  currentTrack.id
                )} blur-2xl opacity-60`}
                aria-hidden="true"
              />
              {/* Subtle vinyl disc peeking from top-right when playing */}
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
                className="relative z-10 w-full h-full rounded-[36px] shadow-[0_32px_75px_rgba(0,0,0,0.75)]"
                iconClass="w-1/4 h-1/4"
              />
            </div>
          </div>

          {/* Quality badge + Live Spectrum */}
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-mono uppercase tracking-[0.16em] text-white/75">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  local ? "bg-emerald-400" : "bg-sky-400"
                }`}
              />
              {local ? "Offline · Hi-Fi" : "Cloud Stream"}
            </span>
            <SpectrumBars playing={isPlaying} />
          </div>

          {/* Title + Actions */}
          <div className="flex items-center gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[26px] text-white leading-tight truncate">
                {currentTrack.title}
              </h2>
              <p className="text-white/60 truncate mt-0.5">
                {currentTrack.artist || "Unknown Artist"}
              </p>
            </div>
            {canSave && (
              <button
                onClick={() => downloadTrack(currentTrack)}
                className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 cursor-pointer"
                aria-label="Save to phone"
              >
                <DownloadCloud className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => toggleFavorite(currentTrack.id)}
              className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              aria-label={currentTrack.isFavorite ? "Unlike" : "Like"}
            >
              <Heart
                className={`w-5 h-5 ${
                  currentTrack.isFavorite ? "fill-fuchsia-400 text-fuchsia-400" : ""
                }`}
              />
            </button>
          </div>

          {error && <p className="text-xs text-rose-300 mb-2">{error}</p>}

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
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-white"
              style={{
                background: `linear-gradient(to right, #e879f9 0%, #a855f7 ${pct}%, rgba(255,255,255,0.18) ${pct}%)`,
              }}
            />
            <div className="flex justify-between text-[11px] font-mono text-white/45 mt-1.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(total)}</span>
            </div>
          </div>

          {/* Primary Transport Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleShuffle}
              className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                isShuffle ? "text-fuchsia-300 bg-fuchsia-500/15" : "text-white/45"
              }`}
              aria-label="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              onClick={previousTrack}
              className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              aria-label="Previous"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>
            <button
              onClick={togglePlayPause}
              className="w-[76px] h-[76px] rounded-full bg-white text-[#05050a] flex items-center justify-center shadow-[0_12px_45px_rgba(232,121,249,0.35)] active:scale-90 transition-transform cursor-pointer"
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
              className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              aria-label="Next"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
            <button
              onClick={cycleRepeatMode}
              className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                repeatMode !== "OFF" ? "text-fuchsia-300 bg-fuchsia-500/15" : "text-white/45"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-mono font-semibold text-white/75 active:scale-95 cursor-pointer"
            >
              <Gauge className="w-3.5 h-3.5 text-fuchsia-300" />
              {playbackRate}×
            </button>

            <button
              onClick={cycleSleepTimer}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-mono font-semibold active:scale-95 cursor-pointer ${
                sleepLabel
                  ? "bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200"
                  : "bg-white/10 border-white/10 text-white/75"
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-cyan-300" />
              {sleepLabel ? `Sleep ${sleepLabel}` : "Sleep"}
            </button>

            <button
              onClick={() => setShowQueue(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-mono font-semibold text-white/75 active:scale-95 cursor-pointer"
            >
              <ListMusic className="w-3.5 h-3.5 text-purple-300" />
              Queue ({queue.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
