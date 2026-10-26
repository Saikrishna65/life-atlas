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
      className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-3.5 right-3.5 sm:left-6 sm:right-6 max-w-xl mx-auto z-40 glass-card-premium rounded-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.12)] overflow-hidden cursor-pointer active:scale-[0.99] transition-all duration-200 select-none group"
      role="region"
      aria-label="Now Playing Mini Player"
    >
      {/* Radiant Glowing Scrub Line with Pulsating Head */}
      <div className="w-full h-[2.5px] bg-white/[0.08] relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-cyan-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)] transition-all duration-150 relative"
          style={{ width: `${progressPercent}%` }}
        >
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
        </div>
      </div>

      <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3 bg-[#070a12]/92 backdrop-blur-2xl">
        {/* Artwork + Title + Live Equalizer */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#121520] border border-white/15 overflow-hidden shrink-0 flex items-center justify-center shadow-lg group-hover:border-amber-400/40 transition-colors">
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
              <Music className="w-5 h-5 text-amber-400/90" />
            )}

            {/* Glowing disc edge overlay */}
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15 pointer-events-none" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                {currentTrack.title}
              </h4>
              {/* Dynamic Equalizer Wave Bars */}
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-3 shrink-0" aria-label="Playing">
                  <span className="w-0.5 bg-gradient-to-t from-amber-400 to-amber-300 rounded-full animate-eq-1" />
                  <span className="w-0.5 bg-gradient-to-t from-amber-400 to-amber-300 rounded-full animate-eq-2" />
                  <span className="w-0.5 bg-gradient-to-t from-cyan-400 to-cyan-300 rounded-full animate-eq-3" />
                  <span className="w-0.5 bg-gradient-to-t from-cyan-400 to-cyan-300 rounded-full animate-eq-4" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] font-sans text-neutral-400 truncate">
                {currentTrack.artist || "Unknown Artist"}
              </p>
              <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-white/5 border border-white/10 text-cyan-300 shrink-0">
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
            className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-90 text-neutral-950 flex items-center justify-center transition-all neon-glow-amber cursor-pointer shadow-lg"
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
            className="w-8 h-8 rounded-full hover:bg-white/10 active:scale-95 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsNowPlayingOpen(true)}
            className="hidden sm:flex w-7 h-7 rounded-full text-neutral-400 hover:text-white items-center justify-center transition-colors"
            aria-label="Expand player"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
