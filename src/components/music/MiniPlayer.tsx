"use client";

import React from "react";
import Image from "next/image";
import { Play, Pause, SkipForward, Music } from "lucide-react";
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
      className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-3 right-3 sm:left-6 sm:right-6 max-w-xl mx-auto z-40 bg-[#12151e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform select-none group"
      role="region"
      aria-label="Now Playing Mini Player"
    >
      {/* Top progress line */}
      <div className="w-full h-[2px] bg-white/10">
        <div
          className="h-full bg-amber-400 transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="p-2.5 sm:p-3 flex items-center justify-between gap-3">
        {/* Artwork + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
            {currentTrack.artworkUrl ? (
              <Image
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <Music className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-amber-400 transition-colors">
              {currentTrack.title}
            </h4>
            <p className="text-[11px] text-muted-foreground truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* Quick Controls */}
        <div
          className="flex items-center gap-1 sm:gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={togglePlayPause}
            className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center transition-colors shadow-sm cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
