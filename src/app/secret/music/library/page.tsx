"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  Search,
  Filter,
  ArrowUpDown,
  Play,
  Pause,
  Heart,
  MoreVertical,
  Trash2,
  ListPlus,
  Plus,
  Music,
  CheckCircle2,
  Sparkles,
  Download,
  DownloadCloud,
  Cloud,
  RefreshCw,
} from "lucide-react";
import { YoutubeIcon } from "@/components/music/YoutubeIcon";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getAllTracks,
  deleteTrack,
  getAllPlaylists,
  addTrackToPlaylist,
  saveTrack,
} from "@/lib/music/storage";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";
import {
  fetchCloudTracks,
  downloadTrackToLocalStorage,
  syncCloudToLocalStorage, deleteTrackFromCloud,
} from "@/lib/music/cloudSync";

type SortField = "RECENT" | "TITLE" | "ARTIST" | "DURATION" | "PLAY_COUNT";
type FilterSource = "ALL" | "FAVORITES" | "OFFLINE" | "CLOUD_ONLY";

export default function MusicLibraryPage() {
  const { playTrack, currentTrack, isPlaying, toggleFavorite, playNext, addToQueue } =
    useMusicPlayer();

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("RECENT");
  const [filterSource, setFilterSource] = useState<FilterSource>("ALL");
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [showPlaylistPickerTrack, setShowPlaylistPickerTrack] = useState<MusicTrack | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const all = await getAllTracks();
      const pls = await getAllPlaylists();
      setTracks(all);
      setPlaylists(pls);

      // Check online database in background to detect cloud tracks
      try {
        const { tracks: cloudTracks } = await fetchCloudTracks();
        if (cloudTracks.length > 0) {
          const localIdSet = new Set(all.map((t) => t.id));
          const missing = cloudTracks.filter((ct) => !localIdSet.has(ct.id));
          if (missing.length > 0 && all.length === 0) {
            // Local storage was cleared or perished! Automatically pull track metadata
            for (const ct of missing) {
              await saveTrack(ct);
            }
            const updated = await getAllTracks();
            setTracks(updated);
          }
        }
      } catch {
        // Offline
      }
    } catch (err) {
      console.error("Failed loading library:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const missingFromLocalCount = useMemo(() => {
    return tracks.filter((t) => !t.audioBlob && (t.audioUrl || t.streamUrl)).length;
  }, [tracks]);

  const filteredAndSortedTracks = useMemo(() => {
    let result = [...tracks];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q)
      );
    }

    // Source filter
    if (filterSource === "FAVORITES") {
      result = result.filter((t) => t.isFavorite);
    } else if (filterSource === "OFFLINE") {
      result = result.filter((t) => !!t.audioBlob);
    } else if (filterSource === "CLOUD_ONLY") {
      result = result.filter((t) => !t.audioBlob);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortField === "RECENT") return b.addedAt - a.addedAt;
      if (sortField === "TITLE") return a.title.localeCompare(b.title);
      if (sortField === "ARTIST") return a.artist.localeCompare(b.artist);
      if (sortField === "DURATION") return b.duration - a.duration;
      if (sortField === "PLAY_COUNT") return (b.playCount || 0) - (a.playCount || 0);
      return 0;
    });

    return result;
  }, [tracks, searchQuery, filterSource, sortField]);

  const handleDelete = async (trackId: string, deleteFromCloud = true) => {
    const promptMsg = deleteFromCloud
      ? "Permanently delete this track from both local storage and the online database?"
      : "Remove from local device storage only? (It will remain safe in your online cloud database).";

    if (confirm(promptMsg)) {
      if (deleteFromCloud) {
        await deleteTrack(trackId, true);
      } else {
        const trk = tracks.find((t) => t.id === trackId);
        if (trk) {
          delete trk.audioBlob;
          trk.source = "STREAM";
          trk.downloadStatus = "IDLE";
          await saveTrack(trk);
        }
      }
      setActiveMenuTrackId(null);
      await loadData();
    }
  };

  const handleDeleteCloudOnly = async (trackId: string) => {
    const trk = tracks.find((t) => t.id === trackId);
    const hasLocal = !!trk?.audioBlob;
    const msg = hasLocal
      ? "Delete this song from the online cloud database? Your copy on this phone stays."
      : "Delete this song from the online cloud database? It is not saved on this phone, so it will be removed completely.";
    if (!confirm(msg)) return;
    setActiveMenuTrackId(null);
    const ok = await deleteTrackFromCloud(trackId);
    if (!ok) {
      alert("Could not delete from the cloud. Check your internet connection and try again.");
      return;
    }
    if (trk) {
      if (hasLocal) {
        trk.syncedToCloud = false;
        delete trk.audioUrl;
        await saveTrack(trk);
      } else {
        await deleteTrack(trackId, false);
      }
    }
    await loadData();
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!showPlaylistPickerTrack) return;
    await addTrackToPlaylist(playlistId, showPlaylistPickerTrack.id);
    setShowPlaylistPickerTrack(null);
  };

  const handleDownloadSingle = async (track: MusicTrack) => {
    setDownloadingTrackId(track.id);
    try {
      await downloadTrackToLocalStorage(track);
      await loadData();
      setSyncStatus(`"${track.title}" downloaded to local storage.`);
      setTimeout(() => setSyncStatus(null), 3500);
    } catch {
      setSyncStatus(`Download failed for "${track.title}".`);
      setTimeout(() => setSyncStatus(null), 3500);
    } finally {
      setDownloadingTrackId(null);
    }
  };

  const handleDownloadAllMissing = async () => {
    setIsSyncing(true);
    setSyncStatus("Downloading cloud tracks to local device storage...");
    try {
      let downloaded = 0;
      for (const track of tracks) {
        if (!track.audioBlob && (track.audioUrl || track.streamUrl)) {
          try {
            await downloadTrackToLocalStorage(track);
            downloaded++;
          } catch {
            // Continue
          }
        }
      }
      await loadData();
      setSyncStatus(`Saved ${downloaded} track(s) to local app storage.`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch {
      setSyncStatus("Error downloading to local storage.");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    setSyncStatus("Syncing with online database...");
    try {
      const res = await syncCloudToLocalStorage();
      await loadData();
      setSyncStatus(`Synced with online database (${res.total} total tracks).`);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch {
      setSyncStatus("Could not connect to online database.");
      setTimeout(() => setSyncStatus(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={loadData} />

      {/* Cloud Status Toast */}
      {syncStatus && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs font-mono text-amber-900 flex items-center gap-2.5 shadow-sm animate-fade-in">
          <Cloud className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Online Database Sync Bar if songs exist online without local copies */}
      {missingFromLocalCount > 0 && (
        <div className="p-4 rounded-3xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                {missingFromLocalCount} song(s) ready in Online Database
              </h4>
              <p className="text-[11px] text-slate-500">
                Download them to local app storage so they remain playable offline even without internet.
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadAllMissing}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-sans text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Add All to Local Storage</span>
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Glass Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search library by title, artist, album, genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/90 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all shadow-xs"
            />
          </div>

          {/* Sync Button & Sort Selector & Shuffle All */}
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("lifeatlas_youtube_share", { detail: { url: "" } }));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 transition-all text-xs font-sans cursor-pointer active:scale-95 shadow-xs"
              title="Import Audio directly from YouTube"
            >
              <YoutubeIcon className="w-3.5 h-3.5 fill-current text-red-600" />
              <span className="font-semibold hidden sm:inline">YouTube</span>
            </button>

            <button
              onClick={handleSyncCloud}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 transition-all text-xs font-sans cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
              title="Sync with online database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="font-semibold hidden sm:inline">Sync Online</span>
            </button>

            {tracks.length > 0 && (
              <button
                onClick={() => {
                  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                  playTrack(shuffled[0], shuffled, { type: "LIBRARY", title: "Shuffled Library" });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card-subtle hover:bg-white text-xs font-sans text-amber-800 border border-amber-300 hover:border-amber-400 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Shuffle all library tracks"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold">Shuffle All</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-white/90 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="RECENT" className="bg-white text-slate-900">Recently Added</option>
                <option value="TITLE" className="bg-white text-slate-900">Title (A-Z)</option>
                <option value="ARTIST" className="bg-white text-slate-900">Artist (A-Z)</option>
                <option value="DURATION" className="bg-white text-slate-900">Duration</option>
                <option value="PLAY_COUNT" className="bg-white text-slate-900">Most Played</option>
              </select>
            </div>
          </div>
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-xs">
          {(["ALL", "FAVORITES", "OFFLINE", "CLOUD_ONLY"] as FilterSource[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterSource(tab)}
              className={`px-3.5 py-1.5 rounded-full transition-all font-sans whitespace-nowrap cursor-pointer active:scale-95 text-xs ${
                filterSource === tab
                  ? "bg-amber-500/15 text-amber-900 font-bold border border-amber-400/50 shadow-xs"
                  : "glass-card-subtle text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:border-slate-300"
              }`}
            >
              {tab === "ALL" && `All Tracks (${tracks.length})`}
              {tab === "FAVORITES" && "Favorites"}
              {tab === "OFFLINE" && "Stored in Local App Storage"}
              {tab === "CLOUD_ONLY" && "Available in Online Database"}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks Listing */}
      {filteredAndSortedTracks.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card-subtle border border-dashed border-slate-300 text-slate-500 text-xs space-y-3">
          <p>No audio files matching the current filter query.</p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={handleSyncCloud}
              className="px-4 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-300 text-xs font-semibold hover:bg-sky-100 transition-colors cursor-pointer"
            >
              Check Online Database
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSortedTracks.map((t, idx) => {
            const isCurrent = currentTrack?.id === t.id;
            const isDownloading = downloadingTrackId === t.id;
            const hasLocalBlob = Boolean(t.audioBlob);

            return (
              <div
                key={t.id}
                onClick={() => playTrack(t, filteredAndSortedTracks, { type: "LIBRARY", title: "Library" })}
                className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer group active:scale-[0.99] relative ${
                  isCurrent
                    ? "bg-amber-500/10 border-amber-400 shadow-sm ring-1 ring-amber-400/30"
                    : "glass-card-subtle hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm"
                }`}
              >
                {/* Left artwork + title */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
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

                    {isCurrent ? (
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                          isCurrent ? "text-amber-900" : "text-slate-900 group-hover:text-amber-800"
                        }`}
                      >
                        {t.title}
                      </h4>
                      {hasLocalBlob ? (
                        <span
                          title="Stored in local app storage & offline ready"
                          className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span className="hidden sm:inline">LOCAL</span>
                        </span>
                      ) : (
                        <span
                          title="Stored in online database"
                          className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200 shrink-0"
                        >
                          <Cloud className="w-2.5 h-2.5" />
                          <span className="hidden sm:inline">ONLINE</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-sans text-slate-500 truncate mt-0.5">
                      {t.artist || "Unknown Artist"} {t.album ? `• ${t.album}` : ""}
                    </p>
                  </div>
                </div>

                {/* Right metadata and actions */}
                <div
                  className="flex items-center gap-1.5 sm:gap-2.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* If missing from local storage, offer Add to Local Storage button */}
                  {!hasLocalBlob && (
                    <button
                      onClick={() => handleDownloadSingle(t)}
                      disabled={isDownloading}
                      title="Add to local storage for offline playback"
                      className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <DownloadCloud className={`w-3.5 h-3.5 ${isDownloading ? "animate-bounce" : ""}`} />
                      <span className="hidden sm:inline">{isDownloading ? "Adding..." : "Add to Local"}</span>
                    </button>
                  )}

                  {/* Favorite Toggle */}
                  <button
                    onClick={() => toggleFavorite(t.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform ${
                        t.isFavorite ? "fill-rose-500 text-rose-500 scale-110" : ""
                      }`}
                    />
                  </button>

                  <span className="text-[11px] font-mono text-slate-500 w-10 text-right hidden sm:inline-block">
                    {Math.floor(t.duration / 60)}:
                    {(t.duration % 60).toString().padStart(2, "0")}
                  </span>

                  {/* Actions Dropdown Button */}
                  <button
                    onClick={() =>
                      setActiveMenuTrackId(activeMenuTrackId === t.id ? null : t.id)
                    }
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Track options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Context Menu Popup */}
                {activeMenuTrackId === t.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-3 top-14 z-30 w-52 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-xl p-1.5 text-xs space-y-1 animate-fade-in"
                  >
                    <button
                      onClick={() => {
                        playNext(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-left text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-amber-600" />
                      <span>Play Next</span>
                    </button>

                    <button
                      onClick={() => {
                        addToQueue(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-left text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <ListPlus className="w-3.5 h-3.5 text-sky-600" />
                      <span>Add to Queue</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowPlaylistPickerTrack(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-left text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Add to Playlist...</span>
                    </button>

                    {!hasLocalBlob && (
                      <button
                        onClick={() => {
                          handleDownloadSingle(t);
                          setActiveMenuTrackId(null);
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-sky-50 text-left text-sky-700 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Save to Local Storage</span>
                      </button>
                    )}

                    {hasLocalBlob && (
                      <button
                        onClick={() => handleDelete(t.id, false)}
                        className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 text-left text-slate-700 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 rotate-180 text-slate-500" />
                        <span>Remove Local Copy (Keep Online)</span>
                      </button>
                    )}

                    <div className="h-[1px] bg-slate-200 my-1" />

                    {(t.syncedToCloud || t.audioUrl || !hasLocalBlob) && (
                      <button
                        onClick={() => handleDeleteCloudOnly(t.id)}
                        className="w-full px-3 py-2 rounded-xl hover:bg-amber-50 text-left text-amber-700 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete from Cloud</span>
                      </button>
                    )}


                    <button
                      onClick={() => handleDelete(t.id, true)}
                      className="w-full px-3 py-2 rounded-xl hover:bg-rose-50 text-left text-rose-600 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete from Everywhere</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Playlist Picker Modal */}
      {showPlaylistPickerTrack && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowPlaylistPickerTrack(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl animate-fade-in"
          >
            <div>
              <h3 className="font-display text-lg text-slate-900 font-normal">Add to Playlist</h3>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                Select a playlist for &quot;{showPlaylistPickerTrack.title}&quot;
              </p>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No playlists created yet.</p>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl.id)}
                    className="w-full p-3 rounded-xl hover:bg-amber-50 hover:border-amber-200 border border-transparent text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-800">{pl.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">{pl.trackIds.length} tracks</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowPlaylistPickerTrack(null)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-sans text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
