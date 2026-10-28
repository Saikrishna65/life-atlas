"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  ListMusic,
  Play,
  Heart,
  Clock,
  Flame,
  CheckCircle2,
  Trash2,
  Copy,
  Music,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getAllPlaylists,
  savePlaylist,
  deletePlaylist,
  getAllTracks,
  getSmartPlaylistTracks,
} from "@/lib/music/storage";
import { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import { formatDuration } from "@/lib/music/metadataParser";

type SmartCollectionKey = "FAVORITES" | "RECENT" | "MOST" | "OFFLINE";

function PlaylistsContent() {
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const searchParams = useSearchParams();
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [, setTracks] = useState<MusicTrack[]>([]);
  const [activeSmartType, setActiveSmartType] = useState<SmartCollectionKey | null>(null);
  const [smartTracks, setSmartTracks] = useState<MusicTrack[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadSmartCollection = useCallback(async (type: SmartCollectionKey) => {
    setActiveSmartType(type);
    if (type === "FAVORITES") {
      setSmartTracks(await getSmartPlaylistTracks("FAVORITES"));
    } else if (type === "RECENT") {
      setSmartTracks(await getSmartPlaylistTracks("RECENTLY_PLAYED"));
    } else if (type === "MOST") {
      setSmartTracks(await getSmartPlaylistTracks("MOST_PLAYED"));
    } else if (type === "OFFLINE") {
      setSmartTracks(await getSmartPlaylistTracks("OFFLINE"));
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const pls = await getAllPlaylists();
      const allTrk = await getAllTracks();
      setPlaylists(pls);
      setTracks(allTrk);
      if (activeSmartType) {
        await loadSmartCollection(activeSmartType);
      }
    } catch (err) {
      console.error("Failed loading playlists:", err);
    }
  }, [activeSmartType, loadSmartCollection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const paramType = searchParams.get("type")?.toLowerCase();
    if (paramType === "favorites") {
      loadSmartCollection("FAVORITES");
    } else if (paramType === "recent") {
      loadSmartCollection("RECENT");
    } else if (paramType === "popular" || paramType === "most") {
      loadSmartCollection("MOST");
    } else if (paramType === "offline") {
      loadSmartCollection("OFFLINE");
    }
  }, [searchParams, loadSmartCollection]);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newPl: MusicPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await savePlaylist(newPl);
    setNewTitle("");
    setNewDesc("");
    setShowCreateModal(false);
    await loadData();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm("Delete this playlist? Your original audio files will remain safe in your library.")) {
      await deletePlaylist(id);
      await loadData();
    }
  };

  const handleDuplicate = async (pl: MusicPlaylist, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const dup: MusicPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: `${pl.title} (Copy)`,
      description: pl.description,
      trackIds: [...pl.trackIds],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await savePlaylist(dup);
    await loadData();
  };

  const handlePlaySmart = async (type: SmartCollectionKey) => {
    await loadSmartCollection(type);
    let list: MusicTrack[] = [];
    let title = "Smart Collection";
    if (type === "FAVORITES") {
      list = await getSmartPlaylistTracks("FAVORITES");
      title = "Favorites";
    } else if (type === "RECENT") {
      list = await getSmartPlaylistTracks("RECENTLY_PLAYED");
      title = "Recently Played";
    } else if (type === "MOST") {
      list = await getSmartPlaylistTracks("MOST_PLAYED");
      title = "Top Rotation";
    } else if (type === "OFFLINE") {
      list = await getSmartPlaylistTracks("OFFLINE");
      title = "Offline Sanctuary";
    }

    if (list.length > 0) {
      playTrack(list[0], list, { type: "SMART_PLAYLIST", title });
    }
  };

  const smartTitleMap: Record<SmartCollectionKey, string> = {
    FAVORITES: "Favorites",
    RECENT: "Recently Played",
    MOST: "Top Rotation",
    OFFLINE: "Offline Sanctuary",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={loadData} />

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-slate-900 font-normal tracking-tight">
            Playlists & Soundtracks
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Curated collections, smart rotations, and expedition accompaniments.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 active:scale-95 text-white font-sans text-xs font-bold tracking-wide transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Smart Collections Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => loadSmartCollection("FAVORITES")}
          className={`p-4 rounded-2xl text-left transition-all duration-200 group flex flex-col justify-between h-28 cursor-pointer active:scale-98 relative overflow-hidden shadow-xs hover:shadow-sm border ${
            activeSmartType === "FAVORITES"
              ? "bg-rose-50/70 border-rose-400 ring-2 ring-rose-400/20"
              : "bg-white/90 hover:bg-white border-rose-200 hover:border-rose-300"
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform shadow-xs">
            <Heart className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 group-hover:text-rose-700">
              Favorites
            </h4>
            <span className="text-[10px] text-slate-500">Auto-synced</span>
          </div>
        </button>

        <button
          onClick={() => loadSmartCollection("RECENT")}
          className={`p-4 rounded-2xl text-left transition-all duration-200 group flex flex-col justify-between h-28 cursor-pointer active:scale-98 relative overflow-hidden shadow-xs hover:shadow-sm border ${
            activeSmartType === "RECENT"
              ? "bg-sky-50/70 border-sky-400 ring-2 ring-sky-400/20"
              : "bg-white/90 hover:bg-white border-sky-200 hover:border-sky-300"
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 group-hover:text-sky-700">
              Recently Played
            </h4>
            <span className="text-[10px] text-slate-500">Listening history</span>
          </div>
        </button>

        <button
          onClick={() => loadSmartCollection("MOST")}
          className={`p-4 rounded-2xl text-left transition-all duration-200 group flex flex-col justify-between h-28 cursor-pointer active:scale-98 relative overflow-hidden shadow-xs hover:shadow-sm border ${
            activeSmartType === "MOST"
              ? "bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20"
              : "bg-white/90 hover:bg-white border-amber-200 hover:border-amber-300"
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform shadow-xs">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 group-hover:text-amber-700">
              Top Rotation
            </h4>
            <span className="text-[10px] text-slate-500">Most played</span>
          </div>
        </button>

        <button
          onClick={() => loadSmartCollection("OFFLINE")}
          className={`p-4 rounded-2xl text-left transition-all duration-200 group flex flex-col justify-between h-28 cursor-pointer active:scale-98 relative overflow-hidden shadow-xs hover:shadow-sm border ${
            activeSmartType === "OFFLINE"
              ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20"
              : "bg-white/90 hover:bg-white border-emerald-200 hover:border-emerald-300"
          }`}
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
              Offline Sanctuary
            </h4>
            <span className="text-[10px] text-slate-500">Airplane Mode</span>
          </div>
        </button>
      </div>

      {/* Active Smart Collection Tracklist */}
      {activeSmartType && (
        <div className="rounded-3xl bg-white border border-slate-200/90 p-5 space-y-4 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg text-slate-900">
                {smartTitleMap[activeSmartType]} ({smartTracks.length})
              </h3>
              <p className="text-xs text-slate-500">
                Tap any song to start playing or play the entire smart collection.
              </p>
            </div>
            {smartTracks.length > 0 && (
              <button
                onClick={() => handlePlaySmart(activeSmartType)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play All</span>
              </button>
            )}
          </div>

          {smartTracks.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No tracks in {smartTitleMap[activeSmartType]} yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {smartTracks.map((t, idx) => {
                const isCurrent = currentTrack?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() =>
                      playTrack(t, smartTracks, {
                        type: "SMART_PLAYLIST",
                        title: smartTitleMap[activeSmartType],
                      })
                    }
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-amber-50 border-amber-300"
                        : "bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/60"
                    }`}
                  >
                    <span className="w-5 text-center text-[11px] font-mono text-slate-400">
                      {isCurrent && isPlaying ? "▶" : idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                      <Music className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{t.artist}</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      {formatDuration(t.duration)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom Playlists */}
      <div className="space-y-3.5">
        <h3 className="font-display text-lg text-slate-900 font-normal flex items-center gap-2">
          <span>Custom Playlists</span>
          <span className="text-xs font-mono text-slate-500">({playlists.length})</span>
        </h3>

        {playlists.length === 0 ? (
          <div className="p-8 text-center rounded-3xl glass-card-subtle border border-dashed border-slate-300 text-slate-500 text-xs space-y-3">
            <ListMusic className="w-8 h-8 text-slate-400 mx-auto" />
            <p>No custom playlists yet. Tap &ldquo;New Playlist&rdquo; to build your first soundtrack.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {playlists.map((pl) => (
              <Link
                key={pl.id}
                href={`/secret/music/playlists/${pl.id}`}
                className="p-4 rounded-2xl bg-white/90 hover:bg-white border border-slate-200 hover:border-amber-300 transition-all duration-200 flex items-center justify-between gap-4 group cursor-pointer active:scale-99 shadow-xs hover:shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                    <ListMusic className="w-6 h-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-slate-900 group-hover:text-amber-800 truncate transition-colors">
                      {pl.title}
                    </h4>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {pl.trackIds.length} track(s)
                      {pl.description ? ` • ${pl.description}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handleDuplicate(pl, e)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer active:scale-90"
                    title="Duplicate playlist"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(pl.id, e)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer active:scale-90"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-slate-900 font-normal">
              Create New Playlist
            </h3>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-xs font-sans text-slate-700 block mb-1">
                  Playlist Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Manali Mountain Drift"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-sans text-slate-700 block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Roadtrip acoustic and high passes"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs text-slate-700 transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold tracking-wide transition-all cursor-pointer active:scale-95 shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlaylistsPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto p-8 text-center text-xs text-slate-400">Loading playlists...</div>}>
      <PlaylistsContent />
    </Suspense>
  );
}
