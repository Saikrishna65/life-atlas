"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  SkipForward,
  Heart,
  Music,
  ArrowUpRight,
  Disc3,
  Shuffle,
  HardDriveDownload,
  Volume2,
  Sliders,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import {
  Artwork,
  Equalizer,
  SpectrumBars,
  formatTime,
  gradientFor,
  hasLocalAudio,
  useLibraryRefresh,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";

export default function MusicDashboardWidget() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    nextTrack,
    toggleFavorite,
    playTrack,
    setIsNowPlayingOpen,
  } = useMusicPlayer();

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const all = await getAllTracks();
      setTracks(all);
    } catch {
      // offline fallback
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useLibraryRefresh(load);

  const offlineCount = useMemo(() => tracks.filter(hasLocalAudio).length, [tracks]);
  const favoritesCount = useMemo(() => tracks.filter((t) => t.isFavorite).length, [tracks]);

  const handlePlayShuffle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tracks.length) return;
    triggerHaptic("tap");
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled, { type: "LIBRARY", title: "Shuffle all" });
  };

  const handlePlayFavorites = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const favs = tracks.filter((t) => t.isFavorite);
    if (!favs.length) return;
    triggerHaptic("tap");
    playTrack(favs[0], favs, { type: "SMART_PLAYLIST", title: "Favorites" });
  };

  const handlePlayOffline = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const off = tracks.filter(hasLocalAudio);
    if (!off.length) return;
    triggerHaptic("tap");
    playTrack(off[0], off, { type: "LIBRARY", title: "Offline Sanctuary" });
  };

  const total = duration || currentTrack?.duration || 0;
  const progressPct = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;
  const isOfflineTrack = currentTrack ? hasLocalAudio(currentTrack) : false;

  return (
    <div className="relative rounded-3xl border border-cyan-500/25 bg-surface/90 hover:border-cyan-400/40 p-5 sm:p-6 transition-all duration-300 shadow-soft overflow-hidden group">
      {/* Ambient reactive background glow */}
      <div
        className={`absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isPlaying ? "bg-cyan-500/15 scale-125" : "bg-cyan-500/5 scale-100"
        }`}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <Link
          href="/secret/music"
          onClick={() => triggerHaptic("tap")}
          className="inline-flex items-center gap-2.5 text-foreground hover:text-cyan-400 transition-colors group/title"
        >
          <div className="w-10 h-10 rounded-xl bg-background/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xs group-hover/title:scale-105 group-hover/title:border-cyan-400/60 transition-all">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-normal tracking-tight group-hover/title:text-cyan-400 transition-colors">
                Music Vault
              </h2>
              {isPlaying && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {currentTrack
                ? isPlaying
                  ? "Live Playback Active"
                  : "Paused · Ready"
                : `${tracks.length} tracks in vault`}
            </p>
          </div>
        </Link>

        <Link
          href="/secret/music"
          onClick={() => triggerHaptic("tap")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 text-xs font-sans tracking-wide uppercase text-cyan-400 font-semibold transition-all cursor-pointer active:scale-95"
        >
          <span>Vault</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Active Track Playing / Last-Played State */}
      {currentTrack ? (
        <div className="relative z-10 space-y-4 pt-1">
          {/* Track Hero Card - Tap opens NowPlayingModal */}
          <div
            onClick={() => {
              triggerHaptic("tap");
              setIsNowPlayingOpen(true);
            }}
            className="flex items-center gap-4 p-3.5 rounded-2xl bg-background/60 border border-cyan-500/20 hover:border-cyan-400/50 hover:bg-background/80 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
          >
            {/* Spinning Vinyl Cover Art */}
            <div className="relative w-16 h-16 shrink-0">
              {/* Rotating vinyl grooves behind artwork */}
              <div
                className={`absolute -right-2 inset-y-1 w-14 rounded-full vinyl-grooves border border-white/10 shadow-md flex items-center justify-center transition-transform duration-700 ${
                  isPlaying ? "translate-x-1 animate-vinyl opacity-80" : "translate-x-0 opacity-40"
                }`}
                aria-hidden="true"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-gradient-to-br ${gradientFor(
                    currentTrack.id
                  )} border-2 border-black`}
                />
              </div>

              <Artwork
                track={currentTrack}
                className="relative z-10 w-16 h-16 rounded-2xl shadow-md border border-white/10"
                iconClass="w-6 h-6"
              />
            </div>

            {/* Title, Artist, & Quality Indicator */}
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/20 text-[9px] font-mono uppercase tracking-wider text-cyan-300 font-medium">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOfflineTrack ? "bg-emerald-400" : "bg-sky-400"
                    }`}
                  />
                  {isOfflineTrack ? "Offline Hi-Fi" : "Cloud Stream"}
                </span>
                {isPlaying && <Equalizer className="h-3" />}
              </div>
              <h3 className="text-sm font-semibold text-foreground truncate">
                {currentTrack.title}
              </h3>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Interactive Scrubber Timeline */}
          <div className="space-y-1.5 px-0.5">
            <div className="h-1.5 rounded-full bg-background/80 border border-muted/40 overflow-hidden">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground/80 px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(total)}</span>
            </div>
          </div>

          {/* Quick-Action Playback Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic("tap");
                  toggleFavorite(currentTrack.id);
                }}
                className="w-10 h-10 rounded-xl bg-background/60 hover:bg-background border border-muted/50 flex items-center justify-center text-muted-foreground hover:text-rose-400 active:scale-90 transition-all cursor-pointer"
                title={currentTrack.isFavorite ? "Remove favorite" : "Mark favorite"}
              >
                <Heart
                  className={`w-4 h-4 ${
                    currentTrack.isFavorite ? "fill-rose-500 text-rose-500" : ""
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic("tap");
                  setIsNowPlayingOpen(true);
                }}
                className="w-10 h-10 rounded-xl bg-background/60 hover:bg-background border border-muted/50 flex items-center justify-center text-muted-foreground hover:text-cyan-400 active:scale-90 transition-all cursor-pointer"
                title="Open Audiophile Player"
              >
                <Disc3 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic("tap");
                  togglePlayPause();
                }}
                className="h-11 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-2 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span className="text-xs uppercase tracking-wider">Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span className="text-xs uppercase tracking-wider">Play</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic("tap");
                  nextTrack();
                }}
                className="w-11 h-11 rounded-2xl bg-background/80 hover:bg-background border border-cyan-500/30 flex items-center justify-center text-foreground active:scale-90 transition-all cursor-pointer"
                title="Next track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Idle State with Instant-Launch Quick Actions */
        <div className="relative z-10 space-y-4 pt-1">
          <p className="font-body text-muted-foreground text-xs sm:text-sm leading-relaxed">
            Your private offline audio sanctuary. Background playback, continuous lock-screen audio, and direct cloud sync.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={handlePlayShuffle}
              disabled={tracks.length === 0}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-background/60 hover:bg-background/90 border border-muted/40 hover:border-cyan-500/40 text-center active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Shuffle className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">Shuffle All</span>
              <span className="text-[9px] font-mono text-muted-foreground">{tracks.length} tracks</span>
            </button>

            <button
              type="button"
              onClick={handlePlayFavorites}
              disabled={favoritesCount === 0}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-background/60 hover:bg-background/90 border border-muted/40 hover:border-rose-500/40 text-center active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                <Heart className="w-4 h-4 fill-rose-500/30 text-rose-500" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">Favorites</span>
              <span className="text-[9px] font-mono text-muted-foreground">{favoritesCount} songs</span>
            </button>

            <button
              type="button"
              onClick={handlePlayOffline}
              disabled={offlineCount === 0}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-background/60 hover:bg-background/90 border border-muted/40 hover:border-emerald-500/40 text-center active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <HardDriveDownload className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">On Phone</span>
              <span className="text-[9px] font-mono text-muted-foreground">{offlineCount} offline</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
