"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  ExternalLink,
  Upload,
  Download,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getAllPlaylists,
  savePlaylist,
  deletePlaylist,
  getAllTracks,
  getSmartPlaylistTracks,
  exportPlaylistM3U,
} from "@/lib/music/storage";
import { MusicPlaylist, MusicTrack } from "@/lib/music/types";

export default function PlaylistsPage() {
  const { playTrack } = useMusicPlayer();
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadData = useCallback(async () => {
    try {
      const pls = await getAllPlaylists();
      const allTrk = await getAllTracks();
      setPlaylists(pls);
      setTracks(allTrk);
    } catch (err) {
      console.error("Failed loading playlists:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handlePlaySmart = async (type: "FAVORITES" | "RECENT" | "MOST" | "OFFLINE") => {
    let smartTracks: MusicTrack[] = [];
    let title = "Smart Collection";
    if (type === "FAVORITES") {
      smartTracks = await getSmartPlaylistTracks("FAVORITES");
      title = "Favorites";
    } else if (type === "RECENT") {
      smartTracks = await getSmartPlaylistTracks("RECENTLY_PLAYED");
      title = "Recently Played";
    } else if (type === "MOST") {
      smartTracks = await getSmartPlaylistTracks("MOST_PLAYED");
      title = "Most Played";
    } else if (type === "OFFLINE") {
      smartTracks = await getSmartPlaylistTracks("OFFLINE");
      title = "Offline Sanctuary";
    }

    if (smartTracks.length > 0) {
      playTrack(smartTracks[0], smartTracks, { type: "SMART_PLAYLIST", title });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28">
      <MusicNav onTrackImported={loadData} />

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-foreground font-normal">
            Playlists & Soundtracks
          </h2>
          <p className="text-xs text-muted-foreground">
            Curated collections, smart rotations, and expedition accompaniments.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-sans text-xs font-semibold tracking-wide transition-all shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Smart Collections Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => handlePlaySmart("FAVORITES")}
          className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 text-left transition-all group flex flex-col justify-between h-24 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform">
            <Heart className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-foreground group-hover:text-rose-400">
              Favorites
            </h4>
            <span className="text-[10px] text-muted-foreground">Auto-synced</span>
          </div>
        </button>

        <button
          onClick={() => handlePlaySmart("RECENT")}
          className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 text-left transition-all group flex flex-col justify-between h-24 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-foreground group-hover:text-cyan-400">
              Recently Played
            </h4>
            <span className="text-[10px] text-muted-foreground">Listening history</span>
          </div>
        </button>

        <button
          onClick={() => handlePlaySmart("MOST")}
          className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 text-left transition-all group flex flex-col justify-between h-24 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-foreground group-hover:text-amber-400">
              Top Rotation
            </h4>
            <span className="text-[10px] text-muted-foreground">Most played</span>
          </div>
        </button>

        <button
          onClick={() => handlePlaySmart("OFFLINE")}
          className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 text-left transition-all group flex flex-col justify-between h-24 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-foreground group-hover:text-emerald-400">
              Offline Sanctuary
            </h4>
            <span className="text-[10px] text-muted-foreground">Airplane Mode</span>
          </div>
        </button>
      </div>

      {/* Custom Playlists */}
      <div className="space-y-3">
        <h3 className="font-display text-lg text-foreground font-normal">
          Custom Playlists ({playlists.length})
        </h3>

        {playlists.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground text-xs space-y-3">
            <ListMusic className="w-8 h-8 text-muted-foreground/60 mx-auto" />
            <p>No custom playlists yet. Tap &ldquo;New Playlist&rdquo; to build your first soundtrack.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {playlists.map((pl) => (
              <Link
                key={pl.id}
                href={`/secret/music/playlists/${pl.id}`}
                className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 transition-all flex items-center justify-between gap-4 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                    <ListMusic className="w-6 h-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-foreground group-hover:text-amber-300 truncate">
                      {pl.title}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {pl.trackIds.length} track(s)
                      {pl.description ? ` • ${pl.description}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleDuplicate(pl, e)}
                    className="p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    title="Duplicate playlist"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(pl.id, e)}
                    className="p-2 text-muted-foreground hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[#141822] border border-white/10 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-foreground font-normal">
              Create New Playlist
            </h3>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-xs font-sans text-neutral-400 block mb-1">
                  Playlist Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Manali Mountain Drift"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-white/10 text-xs sm:text-sm text-foreground focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-sans text-neutral-400 block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Roadtrip acoustic and high passes"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-white/10 text-xs sm:text-sm text-foreground focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold tracking-wide transition-colors cursor-pointer"
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
