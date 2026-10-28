"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Play,
  Heart,
  Clock,
  Flame,
  CheckCircle2,
  ArrowRight,
  Music,
  Headphones,
  Cloud,
  DownloadCloud,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { YoutubeIcon } from "@/components/music/YoutubeIcon";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getAllTracks,
  getAllPlaylists,
  getSmartPlaylistTracks,
  saveTrack,
} from "@/lib/music/storage";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { fetchCloudTracks, downloadTrackToLocalStorage, syncCloudToLocalStorage } from "@/lib/music/cloudSync";

export default function MusicHomePage() {
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [favorites, setFavorites] = useState<MusicTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<MusicTrack[]>([]);
  const [offlineTracks, setOfflineTracks] = useState<MusicTrack[]>([]);
  const [popularTracks, setPopularTracks] = useState<MusicTrack[]>([]);
  const [cloudTracksCount, setCloudTracksCount] = useState<number>(0);
  const [missingLocalCount, setMissingLocalCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

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

      // Check online database in background
      try {
        const cloudData = await fetchCloudTracks();
        setCloudTracksCount(cloudData.tracks.length);

        const localIdSet = new Set(all.map((t) => t.id));
        const missing = cloudData.tracks.filter((ct) => !localIdSet.has(ct.id) || !ct.audioBlob);
        setMissingLocalCount(missing.length);

        // If local storage was cleared or perished, automatically restore track metadata from online database!
        if (all.length === 0 && cloudData.tracks.length > 0) {
          for (const ct of cloudData.tracks) {
            await saveTrack(ct);
          }
          const restored = await getAllTracks();
          setTracks(restored);
          setOfflineTracks(restored.filter((t) => t.source === "IMPORTED" || t.source === "DOWNLOADED" || !!t.audioBlob));
          setSyncStatus(`Restored ${cloudData.tracks.length} track(s) from your online database.`);
          setTimeout(() => setSyncStatus(null), 4000);
        }
      } catch {
        // Offline / network failure handled gracefully
      }
    } catch (err) {
      console.error("Failed loading music home:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalDurationMinutes = useMemo(() => {
    const totalSecs = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    return Math.round(totalSecs / 60);
  }, [tracks]);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks, { type: "LIBRARY", title: "All Music" });
    }
  };

  const handleDownloadAllToLocalStorage = async () => {
    setIsSyncing(true);
    setSyncStatus("Downloading all tracks into local device storage...");
    try {
      const currentTracks = await getAllTracks();
      let downloaded = 0;

      for (const track of currentTracks) {
        if (!track.audioBlob && (track.audioUrl || track.streamUrl)) {
          try {
            await downloadTrackToLocalStorage(track);
            downloaded++;
          } catch {
            // Continue with others
          }
        }
      }

      await loadData();
      setSyncStatus(`Successfully stored ${downloaded} song(s) into local app storage.`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setSyncStatus("Failed downloading some tracks to local storage.");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    setIsSyncing(true);
    setSyncStatus("Connecting to online database...");
    try {
      const result = await syncCloudToLocalStorage();
      await loadData();
      setSyncStatus(`Synced ${result.total} track(s) from online database.`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch (err) {
      setSyncStatus("Could not reach online database.");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={loadData} />

      {/* Cloud Status Banner */}
      {syncStatus && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs font-mono text-amber-900 flex items-center gap-2.5 shadow-sm animate-fade-in">
          <Cloud className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Online Database Sync Notice if local storage is missing copies */}
      {missingLocalCount > 0 && (
        <div className="p-4 rounded-3xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                {missingLocalCount} song(s) available in your Online Database
              </h4>
              <p className="text-[11px] text-slate-500">
                You can add them to local app storage for 100% offline playback.
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadAllToLocalStorage}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-sans text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Add All to Local Storage</span>
          </button>
        </div>
      )}

      {/* Hero Welcome & Master Audio Command Deck */}
      <section className="relative rounded-3xl glass-card-premium p-6 sm:p-8 overflow-hidden shadow-[0_12px_36px_rgba(15,23,42,0.06)] border border-slate-200/90">
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
                <span>EXPEDITION SONIC VAULT</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-card-subtle text-[10px] font-mono text-slate-700 border border-slate-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                LOCAL + CLOUD DUAL SYNC
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
              Your personal music sanctuary. All imported tracks are safely preserved in both your local device storage and your online cloud database.
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
                onClick={handleRestoreFromCloud}
                disabled={isSyncing}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-800 font-sans text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-sky-600 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync with Online Database</span>
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
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-rose-200 hover:border-rose-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.98] relative overflow-hidden shadow-xs hover:shadow-md"
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
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-emerald-200 hover:border-emerald-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.98] relative overflow-hidden shadow-xs hover:shadow-md"
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
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-sky-200 hover:border-sky-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.98] relative overflow-hidden shadow-xs hover:shadow-md"
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
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-amber-200 hover:border-amber-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.98] relative overflow-hidden shadow-xs hover:shadow-md"
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
              <h4 className="text-base font-medium text-slate-900">Your Music Vault is ready</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Import local audio files using the Import button at the top, or sync from your online database if you have previously added tracks.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("lifeatlas_youtube_share", { detail: { url: "" } }));
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-50 border border-red-300 text-red-800 hover:bg-red-100 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <YoutubeIcon className="w-4 h-4 text-red-600 fill-current" />
                <span>Import from YouTube</span>
              </button>

              <button
                onClick={handleRestoreFromCloud}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sky-50 border border-sky-300 text-sky-800 hover:bg-sky-100 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-sky-600 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync with Online Database</span>
              </button>
            </div>
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
                      <Music className="w-5 h-5 text-slate-400" />
                    )}
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    </div>
                  </div>

                  {/* Title and Artist */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate group-hover:text-amber-800 transition-colors">
                      {t.title}
                    </h4>
                    <p className="text-[11px] font-sans text-slate-500 truncate mt-0.5">
                      {t.artist || "Unknown Artist"}
                    </p>
                  </div>

                  {/* Cloud / Local Storage Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.audioBlob ? (
                      <span title="Stored in local storage" className="text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadTrackToLocalStorage(t).then(loadData).catch(() => {});
                        }}
                        title="Stored in online database. Tap to add to local storage"
                        className="p-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200 text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Add to Local</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
