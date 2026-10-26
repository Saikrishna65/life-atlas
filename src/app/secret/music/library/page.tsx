"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  Search,
  Filter,
  ArrowUpDown,
  Play,
  Heart,
  MoreVertical,
  Trash2,
  ListPlus,
  Plus,
  Music,
  CheckCircle2,
  Sparkles,
  Download,
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
  const { playTrack, currentTrack, toggleFavorite, playNext, addToQueue, downloadTrack } =
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28">
      <MusicNav onTrackImported={loadData} />

      {/* Search and Filters Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search library by song, artist, album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-surface border border-white/10 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-surface border border-white/10 text-xs text-foreground py-2 px-3 rounded-xl focus:outline-none focus:border-amber-500/50"
            >
              <option value="RECENT">Recently Added</option>
              <option value="TITLE">Title (A-Z)</option>
              <option value="ARTIST">Artist (A-Z)</option>
              <option value="DURATION">Duration</option>
              <option value="PLAY_COUNT">Most Played</option>
            </select>
          </div>
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {(["ALL", "FAVORITES", "OFFLINE", "STREAMS"] as FilterSource[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterSource(tab)}
              className={`px-3 py-1.5 rounded-xl transition-colors font-sans whitespace-nowrap cursor-pointer ${
                filterSource === tab
                  ? "bg-white/15 text-white font-medium"
                  : "bg-surface text-muted-foreground hover:text-white"
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
        <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground text-xs space-y-2">
          <p>No tracks matching current filter.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
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
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group active:scale-[0.99] relative ${
                  isCurrent
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-surface hover:bg-surface-hover/80 border-white/5"
                }`}
              >
                {/* Artwork + Title */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                    {t.artworkUrl ? (
                      <Image
                        src={t.artworkUrl}
                        alt={t.title}
                        fill
                        sizes="44px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Music className="w-5 h-5 text-amber-400" />
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
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.artist} • {t.album || "Expedition Single"}
                    </p>
                  </div>
                </div>

                {/* Right metadata and actions */}
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Source Icon */}
                  {t.source === "IMPORTED" && (
                    <span
                      title="Stored locally in offline storage"
                      className="text-emerald-400/80"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {t.source === "STREAM" && (
                    <button
                      onClick={() => downloadTrack(t)}
                      title="Download for offline playback"
                      className="text-muted-foreground hover:text-cyan-400 transition-colors p-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Favorite Toggle */}
                  <button
                    onClick={() => toggleFavorite(t.id)}
                    className="p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        t.isFavorite ? "fill-rose-500 text-rose-500" : ""
                      }`}
                    />
                  </button>

                  <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
                    {Math.floor(t.duration / 60)}:
                    {(t.duration % 60).toString().padStart(2, "0")}
                  </span>

                  {/* Actions Dropdown Button */}
                  <button
                    onClick={() =>
                      setActiveMenuTrackId(activeMenuTrackId === t.id ? null : t.id)
                    }
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
                    aria-label="Track options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Context Menu Popup */}
                {activeMenuTrackId === t.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-3 top-12 z-30 w-44 rounded-xl bg-[#161a24] border border-white/10 shadow-2xl p-1.5 text-xs space-y-1 animate-fade-in"
                  >
                    <button
                      onClick={() => {
                        playNext(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-neutral-200 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Play Next</span>
                    </button>

                    <button
                      onClick={() => {
                        addToQueue(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-neutral-200 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      <span>Add to Queue</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowPlaylistPickerTrack(t);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-left text-neutral-200 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Playlist...</span>
                    </button>

                    <div className="h-[1px] bg-white/10 my-1" />

                    <button
                      onClick={() => handleDelete(t.id)}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-left text-rose-400 transition-colors flex items-center gap-2 cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPlaylistPickerTrack(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#141822] border border-white/10 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg text-foreground">
              Add to Playlist
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {showPlaylistPickerTrack.title} — {showPlaylistPickerTrack.artist}
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 no-scrollbar">
              {playlists.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  No custom playlists found. Create one in the Playlists tab!
                </p>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl.id)}
                    className="w-full p-2.5 rounded-xl hover:bg-white/10 text-left text-xs font-medium text-foreground transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>{pl.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {pl.trackIds.length} tracks
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowPlaylistPickerTrack(null)}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
