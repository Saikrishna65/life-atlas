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

  const [showQueue, setShowQueue] = useState(false);
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
      className="fixed inset-0 z-50 bg-[#07090e] text-foreground flex flex-col justify-between animate-fade-in select-none overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing Full View"
    >
      {/* Dynamic Ambient Background Wash from Album Art */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 blur-3xl scale-125 z-0"
        style={{
          backgroundImage: currentTrack.artworkUrl
            ? `url(${currentTrack.artworkUrl})`
            : "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative z-10 px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-3 flex items-center justify-between">
        <button
          onClick={() => setIsNowPlayingOpen(false)}
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer"
          aria-label="Minimize now playing"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        <div className="text-center px-4 min-w-0">
          <span className="text-[10px] uppercase tracking-widest font-mono text-amber-400/90 font-semibold block">
            {sourceContext?.title || "Life Atlas Music Vault"}
          </span>
          <span className="text-xs text-muted-foreground truncate block">
            {currentTrack.album || "Expedition Audio"}
          </span>
        </div>

        <button
          onClick={() => setShowInfo((prev) => !prev)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            showInfo ? "bg-amber-500/20 text-amber-400" : "bg-white/5 hover:bg-white/10 text-neutral-300"
          }`}
          aria-label="Track information"
        >
          <Info className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-6 py-4 max-w-md mx-auto w-full">
        {/* Album Artwork */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-8 bg-[#131722] flex items-center justify-center group">
          {currentTrack.artworkUrl ? (
            <Image
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              fill
              priority
              sizes="(max-width: 640px) 256px, 288px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Music className="w-16 h-16 text-amber-500/60" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground/60">
                Atlas Vault Sound
              </span>
            </div>
          )}
        </div>

        {/* Track Title & Artist & Favorite */}
        <div className="w-full flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight truncate">
              {currentTrack.title}
            </h2>
            <p className="font-sans text-sm sm:text-base text-muted-foreground truncate mt-0.5">
              {currentTrack.artist}
            </p>

            {/* Source & Download Status Badge */}
            <div className="mt-2 flex items-center gap-2">
              {currentTrack.source === "IMPORTED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Offline Local</span>
                </span>
              )}

              {currentTrack.source === "DOWNLOADED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Downloaded Offline</span>
                </span>
              )}

              {currentTrack.source === "STREAM" && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                    <Sparkles className="w-3 h-3" />
                    <span>Live Stream</span>
                  </span>

                  <button
                    onClick={() => downloadTrack(currentTrack)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-sans text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Download track for offline playback"
                  >
                    <Download className="w-3 h-3 text-cyan-400" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => toggleFavorite(currentTrack.id)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer shrink-0 mt-1"
            aria-label={currentTrack.isFavorite ? "Remove favorite" : "Add favorite"}
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                currentTrack.isFavorite
                  ? "fill-rose-500 text-rose-500"
                  : "text-neutral-400 hover:text-white"
              }`}
            />
          </button>
        </div>

        {/* Track Info Drawer (Collapsible) */}
        {showInfo && (
          <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 mb-6 text-xs space-y-1.5 animate-fade-in">
            <div className="flex justify-between text-muted-foreground">
              <span>Format:</span>
              <span className="font-mono text-foreground">{currentTrack.format}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>File Size:</span>
              <span className="font-mono text-foreground">
                {(currentTrack.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Genre:</span>
              <span className="text-foreground">{currentTrack.genre || "Ambient"}</span>
            </div>
            {currentTrack.year && (
              <div className="flex justify-between text-muted-foreground">
                <span>Release Year:</span>
                <span className="text-foreground">{currentTrack.year}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Play Count:</span>
              <span className="font-mono text-amber-400">{currentTrack.playCount || 0} times</span>
            </div>
          </div>
        )}

        {/* Progress Slider */}
        <div className="w-full space-y-2 mb-6">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
            aria-label="Seek time slider"
          />

          <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="w-full flex items-center justify-between mb-6">
          {/* Shuffle Toggle */}
          <button
            onClick={toggleShuffle}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isShuffle ? "text-amber-400 bg-amber-500/10" : "text-neutral-400 hover:text-white"
            }`}
            aria-label="Toggle shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Track */}
          <button
            onClick={previousTrack}
            className="w-12 h-12 rounded-full hover:bg-white/10 flex items-center justify-center text-foreground transition-colors cursor-pointer"
            aria-label="Previous track"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-black flex items-center justify-center shadow-lg transition-transform cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="w-12 h-12 rounded-full hover:bg-white/10 flex items-center justify-center text-foreground transition-colors cursor-pointer"
            aria-label="Next track"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          {/* Repeat Mode Toggle */}
          <button
            onClick={cycleRepeatMode}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              repeatMode !== "OFF" ? "text-amber-400 bg-amber-500/10" : "text-neutral-400 hover:text-white"
            }`}
            aria-label={`Cycle repeat mode, currently ${repeatMode}`}
          >
            {repeatMode === "ONE" ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Bottom Utility Strip: Speed, Volume, and Queue Toggle */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-white/5">
          <button
            onClick={cycleSpeed}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-neutral-300 transition-colors cursor-pointer"
            title="Playback speed"
          >
            {playbackRate}x
          </button>

          <div className="flex items-center gap-2 max-w-[120px] w-full">
            <Volume2 className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
              aria-label="Volume slider"
            />
          </div>

          <button
            onClick={() => setIsNowPlayingOpen(false)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-sans text-neutral-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ListMusic className="w-3.5 h-3.5 text-amber-400" />
            <span>Library</span>
          </button>
        </div>
      </div>
    </div>
  );
}
