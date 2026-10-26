"use client";

import React, { useState } from "react";
import Image from "next/image";
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
  Download,
  CheckCircle2,
  Volume2,
  VolumeX,
  Info,
  Clock,
  Sparkles,
  Music,
  Radio,
  Disc3,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";

function formatSeconds(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function NowPlayingModal() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    repeatMode,
    isShuffle,
    isNowPlayingOpen,
    sourceContext,
    setIsNowPlayingOpen,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    setPlaybackRate,
    toggleShuffle,
    cycleRepeatMode,
    toggleFavorite,
    downloadTrack,
  } = useMusicPlayer();

  const [showInfo, setShowInfo] = useState(false);

  if (!isNowPlayingOpen || !currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek(val);
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIdx = speeds.indexOf(playbackRate);
    const nextIdx = (currentIdx + 1) % speeds.length;
    setPlaybackRate(speeds[nextIdx]);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#04060a] text-white flex flex-col justify-between animate-fade-in select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing Full View"
    >
      {/* Dynamic Ambient Prismatic Background Aura from Album Art */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30 blur-3xl scale-150 z-0 transition-all duration-1000"
        style={{
          backgroundImage: currentTrack.artworkUrl
            ? `radial-gradient(circle at 50% 30%, ${currentTrack.artworkUrl ? 'transparent' : '#f59e0b'}, #04060a), url(${currentTrack.artworkUrl})`
            : "radial-gradient(circle at 50% 25%, rgba(245,158,11,0.25) 0%, rgba(6,182,212,0.15) 45%, #04060a 80%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden="true"
      />

      {/* Deep Obsidian Overlay Gradient */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#04060a]/75 via-[#04060a]/50 to-[#04060a] z-0"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="relative z-10 px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-2 flex items-center justify-between">
        <button
          onClick={() => setIsNowPlayingOpen(false)}
          className="w-10 h-10 rounded-full glass-card-subtle hover:bg-white/10 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all border border-white/10 cursor-pointer shadow-md"
          aria-label="Minimize now playing"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="text-center px-4 min-w-0 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full glass-pill-luxury text-[9px] font-mono tracking-widest text-amber-300 uppercase mb-0.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b]" />
            <span>{sourceContext?.title || "EXPEDITION HI-FI"}</span>
          </div>
          <span className="text-xs text-neutral-400 font-sans truncate max-w-[220px]">
            {currentTrack.album || "Master Recording"}
          </span>
        </div>

        <button
          onClick={() => setShowInfo((prev) => !prev)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border cursor-pointer shadow-md ${
            showInfo
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 neon-glow-amber"
              : "glass-card-subtle hover:bg-white/10 text-neutral-300 border-white/10"
          }`}
          aria-label="Track information"
        >
          <Info className="w-4 h-4" />
        </button>
      </header>

      {/* Main Center Stage */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-6 py-2 max-w-sm sm:max-w-md mx-auto w-full">
        {/* Vinyl & Artwork Stage */}
        <div className="relative mb-5 flex items-center justify-center w-full max-w-[280px] sm:max-w-[320px] aspect-square">
          {/* Peeking Vinyl Record when playing */}
          <div
            className={`absolute w-[92%] h-[92%] rounded-full vinyl-grooves border-2 border-neutral-700/60 shadow-[0_20px_40px_rgba(0,0,0,0.9)] flex items-center justify-center z-0 transition-transform duration-700 ${
              isPlaying
                ? "translate-x-10 sm:translate-x-14 rotate-45 animate-vinyl"
                : "translate-x-0"
            }`}
            aria-hidden="true"
          >
            {/* Center Vinyl Label */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 border-2 border-neutral-900 flex items-center justify-center shadow-inner">
              <div className="w-5 h-5 rounded-full bg-[#04060a] border border-neutral-700" />
            </div>
          </div>

          {/* Front Album Jacket Squircle */}
          <div className="relative w-full h-full rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-[0_25px_60px_-10px_rgba(0,0,0,0.95)] border border-white/20 bg-[#0e111a] flex items-center justify-center z-10 group">
            {currentTrack.artworkUrl ? (
              <Image
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                fill
                priority
                sizes="(max-width: 640px) 280px, 320px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-neutral-400 p-6 text-center">
                <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
                  <Music className="w-10 h-10" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                  Atlas Audio Vault
                </span>
              </div>
            )}

            {/* Specular Holographic Sheen Lines */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-white/15 pointer-events-none" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none rounded-[28px] sm:rounded-[36px]" />
          </div>
        </div>

        {/* Live Audio Visualizer Equalizer Bar (8 Frequencies) */}
        {isPlaying && (
          <div className="flex items-center gap-1.5 h-4 mb-4" aria-label="Audio Visualizer">
            {[1, 2, 3, 4, 5, 6, 7, 8, 3, 5, 2, 6].map((bar, i) => (
              <span
                key={i}
                className={`w-1 rounded-full bg-gradient-to-t from-amber-500 via-amber-300 to-cyan-300 animate-eq-${bar}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            ))}
          </div>
        )}

        {/* Track Title & Artist & Favorite */}
        <div className="w-full flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl sm:text-3xl text-white font-normal tracking-tight truncate">
              {currentTrack.title}
            </h2>
            <p className="font-sans text-sm sm:text-base text-neutral-300 truncate mt-0.5 font-medium">
              {currentTrack.artist || "Unknown Artist"}
            </p>

            {/* Source & Audiophile Format Badge */}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-mono uppercase tracking-widest text-cyan-300 font-bold shadow-xs">
                <span>HI-RES 24-BIT</span>
              </span>

              {currentTrack.source === "IMPORTED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono uppercase tracking-wider text-emerald-300 font-semibold shadow-xs">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Local Master</span>
                </span>
              )}

              {currentTrack.source === "DOWNLOADED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono uppercase tracking-wider text-emerald-300 font-semibold shadow-xs">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Offline Stored</span>
                </span>
              )}

              {currentTrack.source === "STREAM" && (
                <button
                  onClick={() => downloadTrack(currentTrack)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[9px] font-sans text-neutral-200 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Download track for offline playback"
                >
                  <Download className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Download Offline</span>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => toggleFavorite(currentTrack.id)}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5 border ${
              currentTrack.isFavorite
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 neon-glow-rose scale-105"
                : "glass-card-subtle border-white/10 text-neutral-400 hover:text-white hover:bg-white/10"
            }`}
            aria-label={currentTrack.isFavorite ? "Remove favorite" : "Add favorite"}
          >
            <Heart
              className={`w-5 h-5 transition-transform ${
                currentTrack.isFavorite ? "fill-rose-500 scale-110" : ""
              }`}
            />
          </button>
        </div>

        {/* Track Info Drawer (Collapsible) */}
        {showInfo && (
          <div className="w-full p-4 rounded-2xl glass-card-premium mb-4 text-xs space-y-2 animate-fade-in border border-white/15 shadow-xl">
            <div className="flex justify-between text-neutral-400">
              <span>Encoding / Format:</span>
              <span className="font-mono text-cyan-300">{currentTrack.format}</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>File Storage Size:</span>
              <span className="font-mono text-white">
                {(currentTrack.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Genre / Atmosphere:</span>
              <span className="text-white">{currentTrack.genre || "Expedition Soundtrack"}</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Vault Play Count:</span>
              <span className="font-mono text-amber-400 font-bold">{currentTrack.playCount || 0}</span>
            </div>
          </div>
        )}

        {/* Progress Scrubber with Gradient Line */}
        <div className="w-full space-y-1.5 mb-5">
          <div className="relative w-full flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300 transition-all"
              aria-label="Seek time slider"
            />
          </div>

          <div className="flex justify-between text-[11px] font-mono text-neutral-400 px-0.5">
            <span>{formatSeconds(currentTime)}</span>
            <span>-{formatSeconds(Math.max(0, duration - currentTime))}</span>
          </div>
        </div>

        {/* Primary Master Controls */}
        <div className="w-full flex items-center justify-between mb-5 px-1">
          {/* Shuffle Toggle */}
          <button
            onClick={toggleShuffle}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer border ${
              isShuffle
                ? "text-amber-300 bg-amber-500/20 border-amber-500/40 neon-glow-amber"
                : "glass-card-subtle text-neutral-400 hover:text-white border-white/10"
            }`}
            aria-label="Toggle shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous Track */}
          <button
            onClick={previousTrack}
            className="w-13 h-13 rounded-2xl glass-card-subtle hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-white transition-all cursor-pointer shadow-md"
            aria-label="Previous track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Master Radiant Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="w-18 h-18 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-90 text-neutral-950 flex items-center justify-center neon-glow-amber transition-all cursor-pointer shadow-2xl relative"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current stroke-[2.5]" />
            ) : (
              <Play className="w-8 h-8 fill-current stroke-[2.5] ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="w-13 h-13 rounded-2xl glass-card-subtle hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-white transition-all cursor-pointer shadow-md"
            aria-label="Next track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat Mode Toggle */}
          <button
            onClick={cycleRepeatMode}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer border ${
              repeatMode !== "OFF"
                ? "text-amber-300 bg-amber-500/20 border-amber-500/40 neon-glow-amber"
                : "glass-card-subtle text-neutral-400 hover:text-white border-white/10"
            }`}
            aria-label={`Cycle repeat mode, currently ${repeatMode}`}
          >
            {repeatMode === "ONE" ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Bottom Deck: Speed, Volume, and Close */}
        <div className="w-full flex items-center justify-between pt-3 border-t border-white/10">
          <button
            onClick={cycleSpeed}
            className="px-3 py-1.5 rounded-xl glass-card-subtle hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-amber-300 transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Playback speed"
          >
            {playbackRate}x
          </button>

          <div className="flex items-center gap-2 max-w-[130px] w-full px-2">
            <Volume2 className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
              aria-label="Volume slider"
            />
          </div>

          <button
            onClick={() => setIsNowPlayingOpen(false)}
            className="px-3 py-1.5 rounded-xl glass-card-subtle hover:bg-white/10 border border-white/10 text-xs font-sans text-neutral-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <ListMusic className="w-3.5 h-3.5 text-amber-400" />
            <span>Library</span>
          </button>
        </div>
      </div>
    </div>
  );
}
