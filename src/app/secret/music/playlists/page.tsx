"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { getAllPlaylists, savePlaylist, getAllTracks } from "@/lib/music/storage";
import { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import { PlaylistCover, Sheet, EmptyState, useLibraryRefresh } from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [tracksById, setTracksById] = useState<Map<string, MusicTrack>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const [pls, tracks] = await Promise.all([getAllPlaylists(), getAllTracks()]);
      setPlaylists(pls);
      setTracksById(new Map(tracks.map((t) => [t.id, t])));
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useLibraryRefresh(load);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await savePlaylist({
      id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    triggerHaptic("success");
    setTitle("");
    setCreating(false);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-end justify-between px-1 pt-1">
        <h1 className="font-display text-[34px] leading-none">Playlists</h1>
        <button
          onClick={() => {
            triggerHaptic("tap");
            setCreating(true);
          }}
          className="h-11 px-4 rounded-full bg-white text-black text-sm font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> New
        </button>
      </header>

      {loaded && playlists.length === 0 ? (
        <EmptyState
          title="No playlists yet"
          body="Group songs into moods, trips or workouts."
          cta="Create playlist"
          onCta={() => setCreating(true)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {playlists.map((pl) => (
            <Link
              key={pl.id}
              href={`/secret/music/playlists/${pl.id}`}
              onClick={() => triggerHaptic("tap")}
              className="block active:scale-95 transition-transform"
            >
              <PlaylistCover playlist={pl} tracksById={tracksById} className="w-full aspect-square rounded-3xl shadow-xl" />
              <div className="flex items-center gap-1 mt-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{pl.title}</p>
                  <p className="text-xs text-white/45">{pl.trackIds.length} songs</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)}>
        <form onSubmit={create} className="space-y-4">
          <h3 className="font-display text-2xl px-1">New playlist</h3>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your playlist"
            className="w-full h-14 px-5 rounded-2xl bg-white/[0.07] border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/60"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full h-14 rounded-2xl bg-white text-black font-bold disabled:opacity-40 active:scale-[0.98] cursor-pointer"
          >
            Create
          </button>
        </form>
      </Sheet>
    </div>
  );
}
