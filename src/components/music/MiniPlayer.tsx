"use client";

import React from "react";
import Image from "next/image";
import { Play, Pause, SkipForward, Music, ChevronUp } from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";

export default function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    nextTrack,
    setIsNowPlayingOpen,
  } = useMusicPlayer();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      onClick={() => setIsNowPlayingOpen(true)}
      className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-3.5 right-3.5 sm:left-6 sm:right-6 max-w-xl mx-auto z-40 glass-card-premium rounded-2xl border border-slate-200/90 shadow-[0_16px_40px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)] overflow-hidden cursor-pointer active:scale-[0.99] transition-all duration-200 select-none group"
      role="region"
      aria-label="Now Playing Mini Player"
    >
      {/* Radiant Glowing Scrub Line with Pulsating Head */}
      <div className="w-full h-[2.5px] bg-slate-200/80 relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 shadow-xs transition-all duration-150 relative"
          style={{ width: `${progressPercent}%` }}
        >
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-600 shadow-sm" />
        </div>
      </div>

      <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3 bg-white/95 backdrop-blur-2xl">
        {/* Artwork + Title + Live Equalizer */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center shadow-xs group-hover:border-amber-400/60 transition-colors">
            {currentTrack.artworkUrl ? (
              <Image
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                fill
                sizes="48px"
                className={`object-cover ${isPlaying ? "scale-105" : "scale-100"} transition-transform duration-500`}
                unoptimized
              />
            ) : (
              <Music className="w-5 h-5 text-amber-600" />
            )}

            {/* Glowing disc edge overlay */}
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 pointer-events-none" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate group-hover:text-amber-600 transition-colors">
                {currentTrack.title}
              </h4>
              {/* Dynamic Equalizer Wave Bars */}
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-3 shrink-0" aria-label="Playing">
                  <span className="w-0.5 bg-gradient-to-t from-amber-500 to-amber-400 rounded-full animate-eq-1" />
                  <span className="w-0.5 bg-gradient-to-t from-amber-500 to-amber-400 rounded-full animate-eq-2" />
                  <span className="w-0.5 bg-gradient-to-t from-blue-600 to-cyan-500 rounded-full animate-eq-3" />
                  <span className="w-0.5 bg-gradient-to-t from-blue-600 to-cyan-500 rounded-full animate-eq-4" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] font-sans text-slate-500 truncate">
                {currentTrack.artist || "Unknown Artist"}
              </p>
              <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-slate-100 border border-slate-200 text-blue-700 font-bold shrink-0">
                LOSSLESS
              </span>
            </div>
          </div>
        </div>

        {/* Quick Controls */}
        <div
          className="flex items-center gap-1.5 sm:gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-90 text-slate-950 flex items-center justify-center transition-all neon-glow-amber cursor-pointer shadow-md"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current stroke-[2.5]" />
            ) : (
              <Play className="w-4 h-4 fill-current stroke-[2.5] ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="w-8 h-8 rounded-full hover:bg-slate-100 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsNowPlayingOpen(true)}
            className="hidden sm:flex w-7 h-7 rounded-full text-slate-400 hover:text-slate-800 items-center justify-center transition-colors"
            aria-label="Expand player"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
