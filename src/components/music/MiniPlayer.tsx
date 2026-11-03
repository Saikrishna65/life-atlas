"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Play, Pause, SkipForward } from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { Artwork } from "@/components/music/ui";
import { useMusicTheme } from "@/lib/music/theme";
import { triggerHaptic } from "@/lib/deviceAuth";

/**
 * Compact now-playing bar.
 * Rendered once inside the music shell (embedded) and once globally for other
 * private-atlas pages, so exactly one instance is ever visible.
 */
export default function MiniPlayer({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname() || "";
  useMusicTheme();
  const { currentTrack, isPlaying, currentTime, duration, togglePlayPause, nextTrack, setIsNowPlayingOpen } =
    useMusicPlayer();

  const inFinance = pathname.startsWith("/secret/finance");
  const inMusic = pathname.startsWith("/secret/music");
  if (inMusic !== embedded) return null;
  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`music-theme fixed inset-x-4 max-w-md mx-auto select-none ${
        embedded
          ? "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5.1rem)] z-20"
          : `bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 ${inFinance ? "finance-mini-player" : ""}`
      }`}
    >
      <div
        onClick={() => {
          triggerHaptic("tap");
          setIsNowPlayingOpen(true);
        }}
        className="relative overflow-hidden rounded-[26px] bg-[#121215]/95 border border-white/10 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] cursor-pointer active:scale-[0.99] transition-transform"
        role="button"
        aria-label="Open full screen player"
      >
        <div className="flex items-center gap-3 p-2.5 pr-3">
          <Artwork
            track={currentTrack}
            className="w-12 h-12 rounded-2xl shrink-0 shadow-md"
            iconClass="w-5 h-5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-neutral-400 truncate mt-0.5">
              {currentTrack.artist || "Unknown Artist"}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic("tap");
              togglePlayPause();
            }}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-[#f95721] to-[#ff5500] text-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer shadow-[0_4px_16px_rgba(249,87,33,0.4)]"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic("tap");
              nextTrack();
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-400 hover:text-white active:bg-white/10 cursor-pointer transition-colors"
            aria-label="Next track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
        <div className="absolute left-0 bottom-0 h-[2.5px] w-full bg-white/10">
          <div
            style={{
              width: `${progress}%`,
            }}
            className="h-full bg-gradient-to-r from-[#f95721] to-[#ff6b35] transition-all duration-300"
          />
        </div>
      </div>
    </div>
  );
}
