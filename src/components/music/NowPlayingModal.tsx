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
      className="fixed inset-0 z-50 bg-[#f8fafc] text-slate-900 flex flex-col justify-between animate-fade-in select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing Full View"
    >
      {/* Subtle Dynamic Ambient Artwork Glow */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 blur-3xl scale-150 z-0 transition-all duration-1000"
        style={{
          backgroundImage: currentTrack.artworkUrl
            ? `radial-gradient(circle at 50% 30%, ${currentTrack.artworkUrl ? 'transparent' : '#f59e0b'}, #f8fafc), url(${currentTrack.artworkUrl})`
            : "radial-gradient(circle at 50% 25%, rgba(245,158,11,0.2) 0%, rgba(37,99,235,0.1) 45%, #f8fafc 80%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden="true"
      />

      {/* Porcelain Overlay Gradient */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-[#f8fafc]/85 via-white/60 to-[#f8fafc] z-0"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="relative z-10 px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-2 flex items-center justify-between">
        <button
          onClick={() => setIsNowPlayingOpen(false)}
          className="w-10 h-10 rounded-full glass-card-subtle hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-700 hover:text-slate-950 transition-all border border-slate-200/80 cursor-pointer shadow-xs"
          aria-label="Minimize now playing"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="text-center px-4 min-w-0 flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full glass-pill-luxury text-[9px] font-mono tracking-widest text-amber-800 uppercase mb-0.5 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]" />
            <span>{sourceContext?.title || "EXPEDITION HI-FI"}</span>
          </div>
          <span className="text-xs text-slate-500 font-sans truncate max-w-[220px]">
            {currentTrack.album || "Master Recording"}
          </span>
        </div>

        <button
          onClick={() => setShowInfo((prev) => !prev)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border cursor-pointer shadow-xs ${
            showInfo
              ? "bg-amber-100 text-amber-900 border-amber-300 font-bold"
              : "glass-card-subtle hover:bg-slate-100 text-slate-600 border-slate-200/80"
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
            className={`absolute w-[92%] h-[92%] rounded-full vinyl-grooves border-2 border-neutral-800 shadow-[0_16px_35px_rgba(15,23,42,0.35)] flex items-center justify-center z-0 transition-transform duration-700 ${
              isPlaying
                ? "translate-x-10 sm:translate-x-14 rotate-45 animate-vinyl"
                : "translate-x-0"
            }`}
            aria-hidden="true"
          >
            {/* Center Vinyl Label */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 border-2 border-neutral-900 flex items-center justify-center shadow-inner">
              <div className="w-5 h-5 rounded-full bg-neutral-900 border border-neutral-700" />
            </div>
          </div>

          {/* Front Album Jacket Squircle */}
          <div className="relative w-full h-full rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-[0_20px_45px_rgba(15,23,42,0.18)] border border-slate-200/90 bg-white flex items-center justify-center z-10 group">
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
              <div className="flex flex-col items-center gap-3 text-slate-400 p-6 text-center">
                <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 shadow-sm">
                  <Music className="w-10 h-10" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-800 font-bold">
                  Atlas Audio Vault
                </span>
              </div>
            )}

            {/* Specular Holographic Sheen Lines */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/5 via-transparent to-white/40 pointer-events-none" />
            <div className="absolute inset-0 ring-1 ring-inset ring-black/5 pointer-events-none rounded-[28px] sm:rounded-[36px]" />
          </div>
        </div>

        {/* Live Audio Visualizer Equalizer Bar (8 Frequencies) */}
        {isPlaying && (
          <div className="flex items-center gap-1.5 h-4 mb-4" aria-label="Audio Visualizer">
            {[1, 2, 3, 4, 5, 6, 7, 8, 3, 5, 2, 6].map((bar, i) => (
              <span
                key={i}
                className={`w-1 rounded-full bg-gradient-to-t from-amber-500 via-amber-400 to-blue-600 animate-eq-${bar}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              />
            ))}
          </div>
        )}

        {/* Track Title & Artist & Favorite */}
        <div className="w-full flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl sm:text-3xl text-slate-900 font-normal tracking-tight truncate">
              {currentTrack.title}
            </h2>
            <p className="font-sans text-sm sm:text-base text-slate-600 truncate mt-0.5 font-medium">
              {currentTrack.artist || "Unknown Artist"}
            </p>

            {/* Source & Audiophile Format Badge */}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[9px] font-mono uppercase tracking-widest text-blue-700 font-bold shadow-2xs">
                <span>HI-RES 24-BIT</span>
              </span>

              {currentTrack.source === "IMPORTED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-mono uppercase tracking-wider text-emerald-800 font-semibold shadow-2xs">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                  <span>Local Master</span>
                </span>
              )}

              {currentTrack.source === "DOWNLOADED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-mono uppercase tracking-wider text-emerald-800 font-semibold shadow-2xs">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                  <span>Offline Stored</span>
                </span>
              )}

              {currentTrack.source === "STREAM" && (
                <button
                  onClick={() => downloadTrack(currentTrack)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[9px] font-sans text-slate-700 hover:text-slate-950 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="Download track for offline playback"
                >
                  <Download className="w-2.5 h-2.5 text-blue-600" />
                  <span>Download Offline</span>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => toggleFavorite(currentTrack.id)}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5 border ${
              currentTrack.isFavorite
                ? "bg-rose-50 border-rose-300 text-rose-600 scale-105 shadow-xs"
                : "glass-card-subtle border-slate-200/80 text-slate-400 hover:text-rose-500 hover:bg-rose-50/50"
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
          <div className="w-full p-4 rounded-2xl glass-card-premium mb-4 text-xs space-y-2 animate-fade-in border border-slate-200/90 shadow-sm">
            <div className="flex justify-between text-slate-500">
              <span>Encoding / Format:</span>
              <span className="font-mono text-blue-700 font-bold">{currentTrack.format}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>File Storage Size:</span>
              <span className="font-mono text-slate-800">
                {(currentTrack.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Genre / Atmosphere:</span>
              <span className="text-slate-800">{currentTrack.genre || "Expedition Soundtrack"}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Vault Play Count:</span>
              <span className="font-mono text-amber-600 font-bold">{currentTrack.playCount || 0}</span>
            </div>
          </div>
        )}

        {/* Progress Scrubber with Amber-Cobalt Line */}
        <div className="w-full space-y-1.5 mb-5">
          <div className="relative w-full flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeekChange}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition-all"
              aria-label="Seek time slider"
            />
          </div>

          <div className="flex justify-between text-[11px] font-mono text-slate-500 px-0.5">
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
                ? "text-amber-800 bg-amber-100 border-amber-300 shadow-xs"
                : "glass-card-subtle text-slate-500 hover:text-slate-800 border-slate-200/80"
            }`}
            aria-label="Toggle shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous Track */}
          <button
            onClick={previousTrack}
            className="w-13 h-13 rounded-2xl glass-card-subtle hover:bg-slate-100 active:scale-95 border border-slate-200/80 flex items-center justify-center text-slate-800 transition-all cursor-pointer shadow-xs"
            aria-label="Previous track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Master Radiant Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="w-18 h-18 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-90 text-slate-950 flex items-center justify-center neon-glow-amber transition-all cursor-pointer shadow-lg relative"
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
            className="w-13 h-13 rounded-2xl glass-card-subtle hover:bg-slate-100 active:scale-95 border border-slate-200/80 flex items-center justify-center text-slate-800 transition-all cursor-pointer shadow-xs"
            aria-label="Next track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat Mode Toggle */}
          <button
            onClick={cycleRepeatMode}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer border ${
              repeatMode !== "OFF"
                ? "text-amber-800 bg-amber-100 border-amber-300 shadow-xs"
                : "glass-card-subtle text-slate-500 hover:text-slate-800 border-slate-200/80"
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
        <div className="w-full flex items-center justify-between pt-3 border-t border-slate-200/80">
          <button
            onClick={cycleSpeed}
            className="px-3 py-1.5 rounded-xl glass-card-subtle hover:bg-slate-100 border border-slate-200/80 text-xs font-mono font-bold text-amber-800 transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Playback speed"
          >
            {playbackRate}x
          </button>

          <div className="flex items-center gap-2 max-w-[130px] w-full px-2">
            <Volume2 className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              aria-label="Volume slider"
            />
          </div>

          <button
            onClick={() => setIsNowPlayingOpen(false)}
            className="px-3 py-1.5 rounded-xl glass-card-subtle hover:bg-slate-100 border border-slate-200/80 text-xs font-sans text-slate-700 hover:text-slate-950 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
          >
            <ListMusic className="w-3.5 h-3.5 text-amber-600" />
            <span>Library</span>
          </button>
        </div>
      </div>
    </div>
  );
}
