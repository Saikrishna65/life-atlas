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
      <section className="relative rounded-3xl glass-card-premium p-6 sm:p-8 overflow-hidden shadow-[0_12px_36px_rgba(15,23,42,0.06)] border border-slate-200/90">
        {/* Prismatic Radial Mesh Gradients */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 bg-gradient-to-br from-amber-400/20 via-orange-400/10 to-transparent rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-24 w-80 h-80 bg-gradient-to-tr from-sky-400/15 via-indigo-400/10 to-transparent rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono uppercase tracking-widest text-amber-900 font-bold shadow-xs">
                <Headphones className="w-3.5 h-3.5 text-amber-600" />
                <span>EXPEDITION SONIC MATRIX</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-card-subtle text-[10px] font-mono text-slate-700 border border-slate-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_6px_#0ea5e9]" />
                24-BIT / 96kHz LOSSLESS
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-card-subtle text-[10px] font-mono text-slate-600 border border-slate-200/80">
                {tracks.length} tracks · {totalDurationMinutes} mins
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl text-slate-900 font-normal tracking-tight leading-tight">
              Acoustic Sanctuary for the{" "}
              <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 bg-clip-text text-transparent">
                Open Horizon
              </span>
            </h2>

            <p className="font-body text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md">
              Private offline listening deck with bit-perfect local playback, zero telemetry, and immersive expedition acoustics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {tracks.length > 0 ? (
              <button
                onClick={handlePlayAll}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-sans text-xs font-bold uppercase tracking-wider transition-all neon-glow-amber active:scale-95 cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                <span>Play All Vault Tracks</span>
              </button>
            ) : (
              <button
                onClick={handleSeedSamples}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-sans text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Load Sample Soundtracks</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Smart Collections Cards Grid */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-xl text-slate-900 font-normal flex items-center gap-2">
            <span>Smart Collections</span>
          </h3>
          <Link
            href="/secret/music/playlists"
            className="text-xs font-sans text-amber-700 hover:text-amber-600 transition-colors flex items-center gap-1 group font-semibold"
          >
            <span>All Playlists ({playlists.length})</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Favorites */}
          <Link
            href="/secret/music/playlists?type=favorites"
            className="p-4 sm:p-5 rounded-2xl bg-white/90 hover:bg-white border border-rose-200 hover:border-rose-300 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-sm hover:shadow-md"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-rose-500/20 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform shadow-xs">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-rose-700 transition-colors">
                Favorites
              </h4>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{favorites.length} saved tracks</p>
            </div>
          </Link>

          {/* Card 2: Offline Sanctuary */}
          <Link
            href="/secret/music/downloads"
            className="p-4 sm:p-5 rounded-2xl bg-white/90 hover:bg-white border border-emerald-200 hover:border-emerald-300 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-sm hover:shadow-md"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Offline Sanctuary
              </h4>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{offlineTracks.length} local files</p>
            </div>
          </Link>

          {/* Card 3: Recent Listens */}
          <Link
            href="/secret/music/playlists?type=recent"
            className="p-4 sm:p-5 rounded-2xl bg-white/90 hover:bg-white border border-sky-200 hover:border-sky-300 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-sm hover:shadow-md"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-sky-700 transition-colors">
                Recent Listens
              </h4>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{recentTracks.length} tracks</p>
            </div>
          </Link>

          {/* Card 4: Most Played */}
          <Link
            href="/secret/music/playlists?type=popular"
            className="p-4 sm:p-5 rounded-2xl bg-white/90 hover:bg-white border border-amber-200 hover:border-amber-300 transition-all duration-300 group flex flex-col justify-between h-34 active:scale-[0.98] relative overflow-hidden shadow-sm hover:shadow-md"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-colors" />
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform shadow-xs">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                Top Rotation
              </h4>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{popularTracks.length} high plays</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Library Highlights List */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-xl text-slate-900 font-normal flex items-center gap-2">
            <span>Library Highlights</span>
          </h3>
          <Link
            href="/secret/music/library"
            className="text-xs font-sans text-amber-700 hover:text-amber-600 transition-colors flex items-center gap-1 group font-semibold"
          >
            <span>Explore All ({tracks.length})</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {tracks.length === 0 ? (
          <div className="p-10 rounded-3xl glass-card-subtle border border-dashed border-slate-300 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto shadow-xs">
              <Music className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-medium text-slate-900">Your Music Vault is pristine</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Import local audio files from your Android document picker, or load sample ambient tracks to start listening immediately.
              </p>
            </div>
            <button
              onClick={handleSeedSamples}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
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
                      ? "bg-amber-500/10 border-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.12)] ring-1 ring-amber-400/30"
                      : "glass-card-subtle hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm"
                  }`}
                >
                  {/* Track Index or Playing Indicator */}
                  <span className="text-[11px] font-mono text-slate-400 w-5 text-center shrink-0">
                    {isCurrent && isPlaying ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-ping" />
                    ) : (
                      String(idx + 1).padStart(2, "0")
                    )}
                  </span>

                  {/* Artwork + Play Overlay */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
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
                      <Disc className="w-5 h-5 text-amber-600" />
                    )}

                    {isCurrent ? (
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center">
                        {isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3" aria-label="Playing">
                            <span className="w-0.5 bg-amber-300 rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-amber-300 rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-sky-300 rounded-full animate-eq-3" />
                          </div>
                        ) : (
                          <Play className="w-4 h-4 fill-amber-300 text-amber-300 ml-0.5" />
                        )}
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      </div>
                    )}
                  </div>

                  {/* Title & Artist */}
                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                        isCurrent ? "text-amber-900" : "text-slate-900 group-hover:text-amber-800"
                      }`}
                    >
                      {t.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] font-sans text-slate-500 truncate">
                        {t.artist || "Unknown Artist"}
                      </p>
                      {t.source === "IMPORTED" && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          LOCAL
                        </span>
                      )}
                      {t.source === "STREAM" && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                          STREAM
                        </span>
                      )}
                      {t.source === "DOWNLOADED" && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
                          OFFLINE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <span className="text-[11px] font-mono text-slate-500 shrink-0 pr-1">
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
