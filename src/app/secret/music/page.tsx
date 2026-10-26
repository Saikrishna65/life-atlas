"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Play,
  Heart,
  Clock,
  Sparkles,
  Flame,
  CheckCircle2,
  ArrowRight,
  Plus,
  Music,
  Disc,
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

export default function MusicHomePage() {
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [favorites, setFavorites] = useState<MusicTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<MusicTrack[]>([]);
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
      setRecentTracks(recents.slice(0, 6));
    } catch (err) {
      console.error("Failed loading music home:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-28">
      <MusicNav onTrackImported={loadData} />

      {/* Hero Welcome & Quick Start Banner */}
      <section className="relative rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#161a26] via-[#10131c] to-[#0a0d14] p-6 sm:p-8 overflow-hidden shadow-soft">
        <div
          className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 inline-block">
              Sanctuary Enclave
            </span>
            <h2 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight">
              Soundtrack to the Open Road
            </h2>
            <p className="font-body text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Your offline high-fidelity audio vault. Zero cloud ads, zero data tracking, 100% private sound designed for expeditions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {tracks.length > 0 ? (
              <button
                onClick={handlePlayAll}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-sans text-xs font-semibold uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Library</span>
              </button>
            ) : (
              <button
                onClick={handleSeedSamples}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-sans text-xs font-semibold tracking-wide transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Load Sample Tracks</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Smart Playlists Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-foreground font-normal">
            Smart Collections
          </h3>
          <Link
            href="/secret/music/playlists"
            className="text-xs font-sans text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            <span>All Playlists</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Favorites */}
          <Link
            href="/secret/music/playlists?type=favorites"
            className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 transition-all group flex flex-col justify-between h-28"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground group-hover:text-rose-400 transition-colors">
                Favorites
              </h4>
              <p className="text-[11px] text-muted-foreground">{favorites.length} tracks</p>
            </div>
          </Link>

          {/* Recently Played */}
          <Link
            href="/secret/music/playlists?type=recent"
            className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 transition-all group flex flex-col justify-between h-28"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground group-hover:text-cyan-400 transition-colors">
                Recent Listens
              </h4>
              <p className="text-[11px] text-muted-foreground">{recentTracks.length} tracks</p>
            </div>
          </Link>

          {/* Most Played */}
          <Link
            href="/secret/music/playlists?type=popular"
            className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 transition-all group flex flex-col justify-between h-28"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground group-hover:text-amber-400 transition-colors">
                Most Played
              </h4>
              <p className="text-[11px] text-muted-foreground">Top rotation</p>
            </div>
          </Link>

          {/* Offline Sanctuary */}
          <Link
            href="/secret/music/downloads"
            className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 transition-all group flex flex-col justify-between h-28"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                Offline Local
              </h4>
              <p className="text-[11px] text-muted-foreground">100% Airplane Mode</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Recently Added / Highlights */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-foreground font-normal">
            Library Highlights
          </h3>
          <Link
            href="/secret/music/library"
            className="text-xs font-sans text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            <span>View All ({tracks.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {tracks.length === 0 ? (
          <div className="p-10 rounded-2xl border border-dashed border-white/10 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 mx-auto">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Your Music Vault is pristine</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Import local audio files from your Android document picker, or load sample ambient tracks to start listening immediately.
              </p>
            </div>
            <button
              onClick={handleSeedSamples}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 4 Sample Ambient Tracks</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {tracks.slice(0, 8).map((t) => {
              const isCurrent = currentTrack?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => playTrack(t, tracks, { type: "LIBRARY", title: "Library Highlights" })}
                  className={`p-3 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer group active:scale-[0.99] ${
                    isCurrent
                      ? "bg-amber-500/10 border-amber-500/30 shadow-xs"
                      : "bg-surface hover:bg-surface-hover/70 border-white/5"
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
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
                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-medium truncate ${
                        isCurrent ? "text-amber-400" : "text-foreground group-hover:text-amber-300"
                      }`}
                    >
                      {t.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground truncate">{t.artist}</p>
                  </div>

                  <span className="text-[11px] font-mono text-muted-foreground shrink-0 pr-1">
                    {Math.floor(t.duration / 60)}:
                    {(t.duration % 60).toString().padStart(2, "0")}
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
