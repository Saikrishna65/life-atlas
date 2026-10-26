"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Play,
  Pause,
  Heart,
  Clock,
  Sparkles,
  Flame,
  CheckCircle2,
  ArrowRight,
  Plus,
  Music,
  Disc,
  Radio,
  Headphones,
  Compass,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getAllTracks,
  getAllPlaylists,
  saveTrack,
  getSmartPlaylistTracks,
} from "@/lib/music/storage";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { CURATED_EXPEDITION_SAMPLES } from "@/lib/music/samples";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function MusicHomePage() {
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [favorites, setFavorites] = useState<MusicTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<MusicTrack[]>([]);
  const [offlineTracks, setOfflineTracks] = useState<MusicTrack[]>([]);
  const [popularTracks, setPopularTracks] = useState<MusicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const all = await getAllTracks();
      const allPl = await getAllPlaylists();
      setTracks(all);
      setPlaylists(allPl);

      const favs = await getSmartPlaylistTracks("FAVORITES");
      setFavorites(favs);

      const recents = await getSmartPlaylistTracks("RECENTLY_PLAYED");
      setRecentTracks(recents);

      const offline = await getSmartPlaylistTracks("OFFLINE");
      setOfflineTracks(offline);

      const popular = await getSmartPlaylistTracks("MOST_PLAYED");
      setPopularTracks(popular);
    } catch (err) {
      console.error("Failed loading music home:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalDurationMinutes = useMemo(() => {
    const totalSecs = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    return Math.round(totalSecs / 60);
  }, [tracks]);

  const handleSeedSamples = async () => {
    setIsLoading(true);
    try {
      for (const sample of CURATED_EXPEDITION_SAMPLES) {
        const newTrack: MusicTrack = {
          ...sample,
          id: `trk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          addedAt: Date.now(),
        };
        await saveTrack(newTrack);
      }
      await loadData();
    } catch (err) {
      console.error("Error seeding samples:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks, { type: "LIBRARY", title: "All Music" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={loadData} />

      {/* Hero Welcome & Master Audio Command Deck */}
      <section className="relative rounded-3xl glass-card-premium p-6 sm:p-8 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/15">
        {/* Prismatic Radial Mesh Gradients */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 bg-gradient-to-br from-amber-500/25 via-orange-600/10 to-transparent rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-24 w-80 h-80 bg-gradient-to-tr from-cyan-500/20 via-indigo-600/15 to-transparent rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Headphones className="w-3.5 h-3.5 text-amber-400" />
                <span>EXPEDITION SONIC MATRIX</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-card-subtle text-[10px] font-mono text-cyan-300 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
                24-BIT / 96kHz LOSSLESS
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-card-subtle text-[10px] font-mono text-neutral-300 border border-white/10">
                {tracks.length} tracks · {totalDurationMinutes} mins
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl text-white font-normal tracking-tight leading-tight">
              Acoustic Sanctuary for the{" "}
              <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 bg-clip-text text-transparent">
                Open Horizon
              </span>
            </h2>

            <p className="font-body text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-md">
              Private offline listening deck with bit-perfect local playback, zero telemetry, and immersive expedition acoustics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {tracks.length > 0 ? (
              <button
                onClick={handlePlayAll}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-neutral-950 font-sans text-xs font-bold uppercase tracking-wider transition-all neon-glow-amber active:scale-95 cursor-pointer shadow-xl"
              >
                <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                <span>Play All Vault Tracks</span>
              </button>
            ) : (
              <button
                onClick={handleSeedSamples}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-sans text-xs font-semibold tracking-wide transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Load Sample Soundtracks</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Smart Collections Cards Grid */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-xl text-white font-normal flex items-center gap-2">
            <span>Smart Collections</span>
          </h3>
          <Link
            href="/secret/music/playlists"
            className="text-xs font-sans text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 group font-medium"
          >
            <span>All Playlists ({playlists.length})</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Favorites */}
          <Link
            href="/secret/music/playlists?type=favorites"
            className="p-4 sm:p-5 rounded-2xl glass-card-subtle hover:bg-white/[0.08] border border-rose-500/25 hover:border-rose-500/45 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-lg"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-rose-500/25 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-rose-300 transition-colors">
                Favorites
              </h4>
              <p className="text-[11px] font-mono text-neutral-400 mt-0.5">{favorites.length} saved tracks</p>
            </div>
          </Link>

          {/* Card 2: Offline Sanctuary */}
          <Link
            href="/secret/music/downloads"
            className="p-4 sm:p-5 rounded-2xl glass-card-subtle hover:bg-white/[0.08] border border-emerald-500/25 hover:border-emerald-500/45 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-lg"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/25 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Offline Sanctuary
              </h4>
              <p className="text-[11px] font-mono text-neutral-400 mt-0.5">{offlineTracks.length} local files</p>
            </div>
          </Link>

          {/* Card 3: Recent Listens */}
          <Link
            href="/secret/music/playlists?type=recent"
            className="p-4 sm:p-5 rounded-2xl glass-card-subtle hover:bg-white/[0.08] border border-cyan-500/25 hover:border-cyan-500/45 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-lg"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/25 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Recent Listens
              </h4>
              <p className="text-[11px] font-mono text-neutral-400 mt-0.5">{recentTracks.length} tracks</p>
            </div>
          </Link>

          {/* Card 4: Most Played */}
          <Link
            href="/secret/music/playlists?type=popular"
            className="p-4 sm:p-5 rounded-2xl glass-card-subtle hover:bg-white/[0.08] border border-amber-500/25 hover:border-amber-500/45 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-lg"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/25 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                Top Rotation
              </h4>
              <p className="text-[11px] font-mono text-neutral-400 mt-0.5">{popularTracks.length} high plays</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Library Highlights List */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-xl text-white font-normal flex items-center gap-2">
            <span>Library Highlights</span>
          </h3>
          <Link
            href="/secret/music/library"
            className="text-xs font-sans text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 group"
          >
            <span>Explore All ({tracks.length})</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {tracks.length === 0 ? (
          <div className="p-10 rounded-3xl glass-card-subtle border border-dashed border-white/15 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Music className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-medium text-white">Your Music Vault is pristine</h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Import local audio files from your Android document picker, or load sample ambient tracks to start listening immediately.
              </p>
            </div>
            <button
              onClick={handleSeedSamples}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-md active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Load Sample Expedition Soundtracks</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tracks.slice(0, 8).map((t, idx) => {
              const isCurrent = currentTrack?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => playTrack(t, tracks, { type: "LIBRARY", title: "Library Highlights" })}
                  className={`p-3 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 cursor-pointer group active:scale-[0.98] ${
                    isCurrent
                      ? "bg-amber-500/15 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30"
                      : "glass-card-subtle hover:bg-white/[0.08] border-white/10 hover:border-white/20"
                  }`}
                >
                  {/* Track Index or Playing Indicator */}
                  <span className="text-[11px] font-mono text-neutral-400 w-5 text-center shrink-0">
                    {isCurrent && isPlaying ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-ping" />
                    ) : (
                      String(idx + 1).padStart(2, "0")
                    )}
                  </span>

                  {/* Artwork + Play Overlay */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#10131d] border border-white/15 shrink-0 flex items-center justify-center shadow-md">
                    {t.artworkUrl ? (
                      <Image
                        src={t.artworkUrl}
                        alt={t.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Disc className="w-5 h-5 text-amber-400" />
                    )}

                    {isCurrent ? (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                        {isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3" aria-label="Playing">
                            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-cyan-400 rounded-full animate-eq-3" />
                          </div>
                        ) : (
                          <Play className="w-4 h-4 fill-amber-400 text-amber-400 ml-0.5" />
                        )}
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                    )}
                  </div>

                  {/* Title & Artist */}
                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                        isCurrent ? "text-amber-300" : "text-white group-hover:text-amber-200"
                      }`}
                    >
                      {t.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] font-sans text-neutral-400 truncate">
                        {t.artist || "Unknown Artist"}
                      </p>
                      {t.source === "IMPORTED" && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                          LOCAL
                        </span>
                      )}
                      {t.source === "STREAM" && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                          STREAM
                        </span>
                      )}
                      {t.source === "DOWNLOADED" && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                          OFFLINE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <span className="text-[11px] font-mono text-neutral-400 shrink-0 pr-1">
                    {formatDuration(t.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
