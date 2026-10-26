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
  Disc,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getAllTracks,
  deleteTrack,
  getAllPlaylists,
  addTrackToPlaylist,
} from "@/lib/music/storage";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";

type SortField = "RECENT" | "TITLE" | "ARTIST" | "DURATION" | "PLAY_COUNT";
type FilterSource = "ALL" | "FAVORITES" | "OFFLINE" | "STREAMS";

export default function MusicLibraryPage() {
  const { playTrack, currentTrack, isPlaying, toggleFavorite, playNext, addToQueue, downloadTrack } =
    useMusicPlayer();

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("RECENT");
  const [filterSource, setFilterSource] = useState<FilterSource>("ALL");
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [showPlaylistPickerTrack, setShowPlaylistPickerTrack] = useState<MusicTrack | null>(null);

  const loadData = useCallback(async () => {
    try {
      const all = await getAllTracks();
      const pls = await getAllPlaylists();
      setTracks(all);
      setPlaylists(pls);
    } catch (err) {
      console.error("Failed loading library:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      result = result.filter(
        (t) => t.source === "IMPORTED" || t.source === "DOWNLOADED" || !!t.audioBlob
      );
    } else if (filterSource === "STREAMS") {
      result = result.filter((t) => t.source === "STREAM");
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

  const handleDelete = async (trackId: string) => {
    if (confirm("Remove this track from your Music Vault library?")) {
      await deleteTrack(trackId);
      setActiveMenuTrackId(null);
      await loadData();
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!showPlaylistPickerTrack) return;
    await addTrackToPlaylist(playlistId, showPlaylistPickerTrack.id);
    setShowPlaylistPickerTrack(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={loadData} />

      {/* Search and Filters Bar */}
      {/* Search and Filters Bar */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Glass Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search library by title, artist, album, genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-card-subtle border border-white/10 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-400/60 focus:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all"
            />
          </div>

          {/* Sort Selector & Shuffle All */}
          <div className="flex items-center gap-2 shrink-0">
            {tracks.length > 0 && (
              <button
                onClick={() => {
                  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                  playTrack(shuffled[0], shuffled, { type: "LIBRARY", title: "Shuffled Library" });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl glass-card-subtle hover:bg-white/10 text-xs font-sans text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Shuffle all library tracks"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold">Shuffle All</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 glass-card-subtle border border-white/10 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
              >
                <option value="RECENT" className="bg-[#0b0e17] text-white">Recently Added</option>
                <option value="TITLE" className="bg-[#0b0e17] text-white">Title (A-Z)</option>
                <option value="ARTIST" className="bg-[#0b0e17] text-white">Artist (A-Z)</option>
                <option value="DURATION" className="bg-[#0b0e17] text-white">Duration</option>
                <option value="PLAY_COUNT" className="bg-[#0b0e17] text-white">Most Played</option>
              </select>
            </div>
          </div>
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {(["ALL", "FAVORITES", "OFFLINE", "STREAMS"] as FilterSource[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterSource(tab)}
              className={`px-3.5 py-1.5 rounded-full transition-all font-sans whitespace-nowrap cursor-pointer active:scale-95 text-xs ${
                filterSource === tab
                  ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 neon-glow-amber"
                  : "glass-card-subtle text-neutral-400 hover:text-white border border-white/5 hover:border-white/15"
              }`}
            >
              {tab === "ALL" && `All Tracks (${tracks.length})`}
              {tab === "FAVORITES" && "Favorites"}
              {tab === "OFFLINE" && "Offline Local"}
              {tab === "STREAMS" && "Online Streams"}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks Listing */}
      {filteredAndSortedTracks.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card-subtle border border-dashed border-white/10 text-neutral-400 text-xs space-y-2">
          <p>No audio files matching the current filter query.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSortedTracks.map((t, idx) => {
            const isCurrent = currentTrack?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() =>
                  playTrack(t, filteredAndSortedTracks, {
                    type: "LIBRARY",
                    title: "Library",
                  })
                }
                className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3.5 cursor-pointer group active:scale-[0.99] relative ${
                  isCurrent
                    ? "bg-amber-500/15 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/30"
                    : "glass-card-subtle hover:bg-white/[0.08] border-white/10 hover:border-white/20"
                }`}
              >
                {/* Artwork + Title */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
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
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
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

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                        isCurrent ? "text-amber-300" : "text-white group-hover:text-amber-200"
                      }`}
                    >
                      {t.title}
                    </h4>
                    <p className="text-[11px] font-sans text-neutral-400 truncate mt-0.5">
                      {t.artist || "Unknown Artist"} {t.album ? `• ${t.album}` : ""}
                    </p>
                  </div>
                </div>

                {/* Right metadata and actions */}
                <div
                  className="flex items-center gap-2.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Source Badge */}
                  {t.source === "IMPORTED" && (
                    <span
                      title="Stored locally in offline storage"
                      className="text-emerald-400 p-1"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                  {t.source === "STREAM" && (
                    <button
                      onClick={() => downloadTrack(t)}
                      title="Download for offline playback"
                      className="text-neutral-400 hover:text-cyan-400 transition-colors p-1"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  {/* Favorite Toggle */}
                  <button
                    onClick={() => toggleFavorite(t.id)}
                    className="p-1 text-neutral-400 hover:text-rose-400 transition-colors"
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform ${
                        t.isFavorite ? "fill-rose-500 text-rose-500 scale-110" : ""
                      }`}
                    />
                  </button>

                  <span className="text-[11px] font-mono text-neutral-400 w-11 text-right">
                    {Math.floor(t.duration / 60)}:
                    {(t.duration % 60).toString().padStart(2, "0")}
                  </span>

                  {/* Actions Dropdown Button */}
                  <button
                    onClick={() =>
                      setActiveMenuTrackId(activeMenuTrackId === t.id ? null : t.id)
                    }
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Track options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Context Menu Popup */}
                {activeMenuTrackId === t.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-3 top-14 z-30 w-48 rounded-2xl glass-card-premium border border-white/15 shadow-2xl p-1.5 text-xs space-y-1 animate-fade-in"
                  >
                    <button
                      onClick={() => {
                        playNext(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-left text-neutral-200 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-amber-400" />
                      <span>Play Next</span>
                    </button>

                    <button
                      onClick={() => {
                        addToQueue(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-left text-neutral-200 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <ListPlus className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Add to Queue</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowPlaylistPickerTrack(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-left text-neutral-200 hover:text-white transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Add to Playlist...</span>
                    </button>

                    <div className="h-[1px] bg-white/10 my-1" />

                    <button
                      onClick={() => handleDelete(t.id)}
                      className="w-full px-3 py-2 rounded-xl hover:bg-rose-500/20 text-left text-rose-400 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete from Vault</span>
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowPlaylistPickerTrack(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl glass-card-premium border border-white/15 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg text-white font-normal">
              Add to Playlist
            </h3>
            <p className="text-xs text-neutral-400 truncate">
              {showPlaylistPickerTrack.title} — {showPlaylistPickerTrack.artist}
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 scrollbar-none">
              {playlists.length === 0 ? (
                <p className="text-xs text-neutral-400 p-3 text-center">
                  No custom playlists found. Create one in the Playlists tab!
                </p>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl.id)}
                    className="w-full p-3 rounded-2xl glass-card-subtle hover:bg-white/10 text-left text-xs font-medium text-white transition-all flex items-center justify-between cursor-pointer border border-white/5 hover:border-amber-500/30 active:scale-98"
                  >
                    <span>{pl.title}</span>
                    <span className="text-[11px] font-mono text-amber-300">
                      {pl.trackIds.length} tracks
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowPlaylistPickerTrack(null)}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer border border-white/10 active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
