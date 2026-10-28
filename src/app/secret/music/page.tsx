"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Play,
  Pause,
  Shuffle,
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
  FolderPlus,
  Disc3,
  Volume2,
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
import { fetchCloudTracks, downloadTrackToLocalStorage, syncCloudToLocalStorage, uploadTrackToCloud } from "@/lib/music/cloudSync";
import { parseAudioFile } from "@/lib/music/metadataParser";
import { triggerHaptic, openFilePicker, markPickerGotFile } from "@/lib/deviceAuth";

export default function MusicHomePage() {
  const { playTrack, currentTrack, isPlaying, togglePlayPause, setIsNowPlayingOpen } = useMusicPlayer();
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Direct, infallible opener for the YouTube Audio Bottom Sheet
  const openYouTubeModal = (url = "") => {
    triggerHaptic("tap");
    const win = window as unknown as { __openYouTubeModal?: (u?: string) => void };
    if (typeof win.__openYouTubeModal === "function") {
      win.__openYouTubeModal(url);
    } else {
      window.dispatchEvent(new CustomEvent("lifeatlas_youtube_share", { detail: { url } }));
    }
  };

  const handlePlayAll = () => {
    triggerHaptic("tap");
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks, { type: "LIBRARY", title: "All Music" });
    }
  };

  const handleShufflePlay = () => {
    triggerHaptic("tap");
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled, { type: "LIBRARY", title: "Smart Vault Shuffle" });
  };

  const handleDownloadAllToLocalStorage = async () => {
    triggerHaptic("tap");
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
      triggerHaptic("success");
      setTimeout(() => setSyncStatus(null), 4000);
    } catch {
      setSyncStatus("Failed downloading some tracks to local storage.");
      triggerHaptic("error");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    triggerHaptic("tap");
    setIsSyncing(true);
    setSyncStatus("Connecting to online database...");
    try {
      const result = await syncCloudToLocalStorage();
      await loadData();
      setSyncStatus(`Synced ${result.total} track(s) from online database.`);
      triggerHaptic("success");
      setTimeout(() => setSyncStatus(null), 4000);
    } catch {
      setSyncStatus("Could not reach online database.");
      triggerHaptic("error");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    markPickerGotFile();
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const selectedFiles = Array.from(fileList);

    setIsSyncing(true);
    setSyncStatus(`Importing ${selectedFiles.length} audio file(s)...`);
    triggerHaptic("tap");

    try {
      const existing = await getAllTracks();
      let imported = 0;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const arrayBuffer = await file.arrayBuffer();
        const mimeType = file.type || "audio/mpeg";
        const memoryBlob = new Blob([arrayBuffer], { type: mimeType });

        const parsed = await parseAudioFile(file);

        const isDup = existing.some(
          (t) =>
            (t.title.toLowerCase() === parsed.title.toLowerCase() &&
              t.artist.toLowerCase() === parsed.artist.toLowerCase()) ||
            (t.fileName === file.name && t.size === memoryBlob.size)
        );

        if (isDup) continue;

        const newTrack: MusicTrack = {
          id: `trk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          title: parsed.title,
          artist: parsed.artist,
          album: parsed.album,
          genre: parsed.genre,
          year: parsed.year,
          duration: parsed.duration || 0,
          format: mimeType,
          size: memoryBlob.size,
          artworkUrl: parsed.artworkUrl,
          audioBlob: memoryBlob,
          source: "IMPORTED",
          isFavorite: false,
          playCount: 0,
          addedAt: Date.now(),
          fileName: file.name,
        };

        await saveTrack(newTrack);
        existing.push(newTrack);
        imported++;

        uploadTrackToCloud(newTrack, memoryBlob).catch(() => {});
      }

      window.dispatchEvent(new Event("lifeatlas_tracks_updated"));
      await loadData();
      setSyncStatus(`Imported ${imported} song(s) successfully.`);
      triggerHaptic("success");
      setTimeout(() => setSyncStatus(null), 4000);
    } catch {
      setSyncStatus("Failed to import audio files.");
      triggerHaptic("error");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-7 animate-fade-in pb-36 select-none overflow-x-hidden">
      <MusicNav onTrackImported={loadData} />

      {/* Hidden native document audio selector for Thumb Dock */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleLocalFileChange}
        accept="audio/*"
        multiple
        className="hidden"
      />

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
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-sans text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Add All to Local Storage</span>
          </button>
        </div>
      )}

      {/* NOW PLAYING SPOTLIGHT (If currently active) OR HERO DECK */}
      {currentTrack ? (
        <section
          onClick={() => {
            triggerHaptic("tap");
            setIsNowPlayingOpen(true);
          }}
          className="relative rounded-3xl glass-card-premium p-5 sm:p-6 overflow-hidden shadow-[0_12px_36px_rgba(15,23,42,0.08)] border border-amber-300/80 cursor-pointer group active:scale-[0.99] transition-all"
        >
          {/* Ambient Glow */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {/* Rotating Vinyl Turntable Disc */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                <div
                  className={`w-full h-full rounded-full bg-neutral-900 border-2 border-neutral-700 shadow-md flex items-center justify-center ${
                    isPlaying ? "animate-spin [animation-duration:8s]" : ""
                  }`}
                >
                  {/* Subtle Vinyl Grooves */}
                  <div className="w-12 h-12 rounded-full border border-neutral-800 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center overflow-hidden bg-amber-500/20">
                      {currentTrack.artworkUrl ? (
                        <Image
                          src={currentTrack.artworkUrl}
                          alt="Album Art"
                          width={32}
                          height={32}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      ) : (
                        <Disc3 className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Live Soundwave Bars */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] font-mono text-amber-900 font-bold uppercase">
                    <Volume2 className="w-3 h-3 text-amber-600" />
                    <span>Now Playing</span>
                  </span>
                  {isPlaying && (
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-full bg-amber-600 rounded-full animate-pulse" />
                      <span className="w-0.5 h-2/3 bg-amber-500 rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="w-0.5 h-full bg-amber-600 rounded-full animate-pulse [animation-delay:300ms]" />
                    </div>
                  )}
                </div>
                <h3 className="font-display text-base sm:text-lg font-normal text-slate-900 truncate mt-1">
                  {currentTrack.title}
                </h3>
                <p className="text-xs text-slate-500 truncate">{currentTrack.artist || "Unknown Artist"}</p>
              </div>
            </div>

            {/* Quick Play/Pause Control */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic("tap");
                  togglePlayPause();
                }}
                className="w-11 h-11 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 flex items-center justify-center shadow-md transition-all cursor-pointer"
                aria-label={isPlaying ? "Pause track" : "Play track"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Standard Sonic Vault Hero Deck */
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
            <div className="space-y-3 max-w-lg">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono uppercase tracking-widest text-amber-900 font-bold shadow-xs">
                  <Headphones className="w-3.5 h-3.5 text-amber-600" />
                  <span>EXPEDITION SONIC VAULT</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-card-subtle text-[10px] font-mono text-slate-700 border border-slate-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                  OFFLINE + CLOUD
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-card-subtle text-[10px] font-mono text-slate-600 border border-slate-200/80">
                  {tracks.length} tracks · {totalDurationMinutes} mins
                </span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl text-slate-900 font-normal tracking-tight leading-tight">
                Acoustic Sanctuary for the{" "}
                <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 bg-clip-text text-transparent font-medium">
                  Open Horizon
                </span>
              </h2>

              <p className="font-body text-xs text-slate-600 leading-relaxed max-w-md">
                All music tracks are preserved in local storage and synced to cloud.
              </p>
            </div>

            <div className="flex flex-row items-center gap-2.5 shrink-0">
              {tracks.length > 0 ? (
                <>
                  <button
                    onClick={handleShufflePlay}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl glass-card-subtle hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 text-amber-600" />
                    <span>Shuffle</span>
                  </button>

                  <button
                    onClick={handlePlayAll}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-sans text-xs font-bold uppercase tracking-wider transition-all neon-glow-amber active:scale-95 cursor-pointer shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                    <span>Play All</span>
                  </button>
                </>
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
      )}

      {/* Smart Collections Cards Grid - Tactile One-Hand Touch Targets */}
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
            onClick={() => triggerHaptic("tap")}
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-rose-200 hover:border-rose-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.97] relative overflow-hidden shadow-xs hover:shadow-md cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-rose-500/20 transition-colors" />
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform shadow-xs">
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
            onClick={() => triggerHaptic("tap")}
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-emerald-200 hover:border-emerald-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.97] relative overflow-hidden shadow-xs hover:shadow-md cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors" />
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-xs">
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
            onClick={() => triggerHaptic("tap")}
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-sky-200 hover:border-sky-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.97] relative overflow-hidden shadow-xs hover:shadow-md cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-colors" />
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform shadow-xs">
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
            onClick={() => triggerHaptic("tap")}
            className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50 border border-amber-200 hover:border-amber-300 transition-all duration-300 group flex flex-col justify-between min-h-[120px] active:scale-[0.97] relative overflow-hidden shadow-xs hover:shadow-md cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-colors" />
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform shadow-xs">
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
          /* Redesigned Empty State Card (Matches Image 2 with infallible 1-tap actions) */
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto shadow-xs">
              <Music className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-lg sm:text-xl font-normal text-slate-900">Your Music Vault is ready</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Extract high-fidelity audio from YouTube, import local audio files, or sync from your online database.
              </p>
            </div>

            {/* Infallible One-Hand Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => openYouTubeModal("")}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 text-xs font-bold tracking-wide transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <YoutubeIcon className="w-4 h-4 text-red-600 fill-current" />
                <span>Import from YouTube</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreFromCloud}
                disabled={isSyncing}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-800 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-sky-600 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync Online Database</span>
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
                  onClick={() => {
                    triggerHaptic("tap");
                    playTrack(t, tracks, { type: "LIBRARY", title: "Library Highlights" });
                  }}
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
                          triggerHaptic("tap");
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

      {/* FLOATING ONE-HAND QUICK ACTION THUMB DOCK */}
      <aside
        className={`fixed ${
          currentTrack ? "bottom-[5.75rem]" : "bottom-4"
        } inset-x-3 sm:inset-x-auto sm:right-6 sm:w-auto max-w-md mx-auto z-30 pointer-events-auto select-none transition-all duration-300`}
        aria-label="One Hand Quick Actions"
      >
        <div className="rounded-2xl sm:rounded-full p-1.5 sm:px-3 sm:py-2 border border-slate-200 shadow-[0_12px_32px_rgba(15,23,42,0.15)] flex items-center justify-between sm:justify-center gap-2 backdrop-blur-xl bg-white/95">
          {/* 1. YouTube Audio Extractor Button */}
          <button
            onClick={() => openYouTubeModal("")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer"
            title="Import audio from YouTube"
          >
            <YoutubeIcon className="w-4 h-4 fill-current shrink-0 text-red-600" />
            <span className="text-[11px] font-semibold">YouTube</span>
          </button>

          {/* 2. Instant Smart Shuffle */}
          <button
            onClick={handleShufflePlay}
            disabled={tracks.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold active:scale-95 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
            title="Shuffle entire vault"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[11px] font-semibold">Shuffle</span>
          </button>

          {/* 3. Direct Audio File Picker */}
          <button
            onClick={() => {
              triggerHaptic("tap");
              openFilePicker(fileInputRef.current, () => {
                setSyncStatus("No song was received from the Android file picker. Tap Import, then choose Audio or Files from the picker menu and select your song.");
                setTimeout(() => setSyncStatus(null), 6000);
              });
            }}
            disabled={isSyncing}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold active:scale-95 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
            title="Import audio files"
          >
            <FolderPlus className="w-3.5 h-3.5 text-slate-700 shrink-0" />
            <span className="text-[11px] font-semibold">Import</span>
          </button>

          {/* 4. Instant Cloud Sync */}
          <button
            onClick={handleRestoreFromCloud}
            disabled={isSyncing}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold active:scale-95 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
            title="Sync with online database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="text-[11px] font-semibold">Sync</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
