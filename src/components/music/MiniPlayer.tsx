"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Play, Pause, SkipForward } from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { Artwork } from "@/components/music/ui";

/**
 * Compact now-playing bar.
 * Rendered once inside the music shell (embedded) and once globally for other
 * private-atlas pages, so exactly one instance is ever visible.
 */
export default function MiniPlayer({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname() || "";
  const { currentTrack, isPlaying, currentTime, duration, togglePlayPause, nextTrack, setIsNowPlayingOpen } =
    useMusicPlayer();

  const inMusic = pathname.startsWith("/secret/music");
  if (inMusic !== embedded) return null;
  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`sonic-dark fixed inset-x-4 max-w-md mx-auto select-none ${
        embedded
          ? "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5.1rem)] z-20"
          : "bottom-[max(env(safe-area-inset-bottom),1rem)] z-40"
      }`}
    >
      <div
        onClick={() => setIsNowPlayingOpen(true)}
        className="relative overflow-hidden rounded-[24px] bg-[#161622]/95 backdrop-blur-2xl border border-white/15 shadow-[0_18px_45px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] cursor-pointer active:scale-[0.99] transition-transform"
        role="button"
        aria-label="Open player"
      >
        <div className="flex items-center gap-3 p-2.5 pr-3">
          <Artwork
            track={currentTrack}
            className={`w-12 h-12 rounded-2xl shrink-0 ${isPlaying ? "ring-2 ring-fuchsia-400/60" : ""}`}
            iconClass="w-5 h-5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-white/50 truncate">{currentTrack.artist || "Unknown Artist"}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 active:bg-white/10 cursor-pointer"
            aria-label="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
        <div className="absolute left-0 bottom-0 h-[3px] w-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
