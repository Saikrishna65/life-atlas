"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Play, Pause, SkipForward } from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { Artwork } from "@/components/music/ui";
import { useMusicTheme } from "@/lib/music/theme";

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

  const inMusic = pathname.startsWith("/secret/music");
  if (inMusic !== embedded) return null;
  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`music-theme fixed inset-x-4 max-w-md mx-auto select-none ${
        embedded
          ? "bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5.1rem)] z-20"
          : "bottom-[max(env(safe-area-inset-bottom),1rem)] z-40"
      }`}
    >
      <div
        onClick={() => setIsNowPlayingOpen(true)}
        style={{
          background: "var(--mv-dock)",
          borderColor: "var(--mv-border)",
          boxShadow: "0 18px 45px var(--mv-shadow)",
        }}
        className="relative overflow-hidden rounded-[24px] backdrop-blur-2xl border cursor-pointer active:scale-[0.99] transition-transform"
        role="button"
        aria-label="Open player"
      >
        <div className="flex items-center gap-3 p-2.5 pr-3">
          <Artwork
            track={currentTrack}
            className="w-12 h-12 rounded-2xl shrink-0"
            iconClass="w-5 h-5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--mv-text)] truncate">{currentTrack.title}</p>
            <p className="text-xs text-[var(--mv-text-muted)] truncate">
              {currentTrack.artist || "Unknown Artist"}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            style={{
              background: "var(--mv-primary-bg)",
              color: "var(--mv-primary-fg)",
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer shadow"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--mv-text-muted)] active:bg-[var(--mv-card-hover)] cursor-pointer"
            aria-label="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>
        <div className="absolute left-0 bottom-0 h-[3px] w-full bg-[var(--mv-track)]">
          <div
            style={{
              width: `${progress}%`,
              background: "linear-gradient(to right, var(--mv-accent), var(--mv-accent-2))",
            }}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
