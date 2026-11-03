"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Plus, Play, Pause, Music } from "lucide-react";
import { getAllPlaylists, savePlaylist, getAllTracks } from "@/lib/music/storage";
import { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import { Sheet, EmptyState, useLibraryRefresh, Equalizer } from "@/components/music/ui";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { triggerHaptic } from "@/lib/deviceAuth";
import CategoryTabs from "@/components/music/CategoryTabs";

interface ShowcasePlaylistCard {
  id: string;
  title: string;
  songCountText: string;
  durationText: string;
  isPlayingInitially?: boolean;
  thumbnails: {
    title: string;
    artist: string;
    artworkUrl: string;
    isPlaying?: boolean;
  }[];
}

// Reference playlists exactly matching Image 4
const SHOWCASE_PLAYLISTS: ShowcasePlaylistCard[] = [
  {
    id: "pl_road_trip_anthems",
    title: "Road Trip Anthems",
    songCountText: "02 / 28 Songs",
    durationText: "2 hours 32 Minutes",
    isPlayingInitially: true,
    thumbnails: [
      {
        title: "Starboy",
        artist: "The Weeknd, Daft Punk",
        artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
      },
      {
        title: "Bad Guy",
        artist: "Billie Eilish",
        artworkUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80",
        isPlaying: true,
      },
      {
        title: "Calm Down",
        artist: "Rema, Selena",
        artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80",
      },
    ],
  },
  {
    id: "pl_desert_mirage_fusion",
    title: "Desert Mirage Fusion",
    songCountText: "28 Songs",
    durationText: "1 hours 20 Minutes",
    thumbnails: [
      {
        title: "Big Dawgs",
        artist: "Hanumankind",
        artworkUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      },
      {
        title: "Time N Affection",
        artist: "Rema",
        artworkUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
      },
      {
        title: "Tis The Season",
        artist: "The Weeknd, Daft Punk",
        artworkUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
      },
    ],
  },
];

export default function PlaylistsPage() {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, sourceContext } = useMusicPlayer();
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
  const [tracksById, setTracksById] = useState<Map<string, MusicTrack>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [activePlayId, setActivePlayId] = useState<string | null>("pl_road_trip_anthems");

  const load = useCallback(async () => {
    try {
      const [pls, tracks] = await Promise.all([getAllPlaylists(), getAllTracks()]);
      setAllTracks(tracks);
      setTracksById(new Map(tracks.map((t) => [t.id, t])));
      setPlaylists(pls);
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

  const totalCount = Math.max(24, playlists.length + SHOWCASE_PLAYLISTS.length);

  return (
    <div className="space-y-6 pb-28 animate-fade-in select-none">
      {/* Top Category Navigation Tabs */}
      <CategoryTabs />

      {/* Header: 24 Playlists + Create New (Exact Image 4) */}
      <header className="flex items-center justify-between px-1 pt-1">
        <div>
          <span className="block text-3xl font-extrabold text-white tracking-tight">
            {totalCount}
          </span>
          <span className="block text-2xl font-bold text-white/90 tracking-tight">
            Playlists
          </span>
        </div>

        {/* Orange Circular Border with '+' Icon & Create New text (Exact Image 4) */}
        <button
          onClick={() => {
            triggerHaptic("tap");
            setCreating(true);
          }}
          className="group flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-white/[0.04] active:scale-95 transition-all cursor-pointer"
          aria-label="Create New Playlist"
        >
          <span className="w-9 h-9 rounded-full border border-[#f95721] text-[#f95721] flex items-center justify-center transition-transform group-hover:scale-105 shadow-[0_0_12px_rgba(249,87,33,0.3)]">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </span>
          <span className="text-xs font-semibold text-neutral-300 group-hover:text-white">
            Create New
          </span>
        </button>
      </header>

      {/* Playlists Cards Showcase (Exact Image 4) */}
      <div className="space-y-5">
        {/* Showcase Playlist 1: Road Trip Anthems */}
        {SHOWCASE_PLAYLISTS.map((sp) => {
          const isThisActive = activePlayId === sp.id && isPlaying;

          return (
            <div
              key={sp.id}
              className="relative overflow-hidden rounded-[28px] bg-[#121215] border border-white/[0.06] p-4.5 space-y-4 shadow-xl hover:border-white/[0.12] transition-colors"
            >
              {/* 3 Square Track Thumbnails Collage Side by Side */}
              <div className="grid grid-cols-3 gap-2.5">
                {sp.thumbnails.map((t, idx) => (
                  <div
                    key={`${sp.id}_${idx}`}
                    onClick={() => {
                      triggerHaptic("tap");
                      setActivePlayId(sp.id);
                      if (allTracks.length > 0) {
                        playTrack(allTracks[idx % allTracks.length], allTracks, {
                          type: "PLAYLIST",
                          title: sp.title,
                        });
                      }
                    }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 border border-white/[0.08] cursor-pointer active:scale-95 transition-transform"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.artworkUrl}
                      alt={t.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Center Icon Overlay (Play or Animated Equalizer Waveform) */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {t.isPlaying || (isThisActive && idx === 1) ? (
                        <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-[#f95721]/50 flex items-center justify-center shadow-lg">
                          <Equalizer className="h-3" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center text-black group-hover:bg-white group-hover:scale-110 transition-all">
                          <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                        </div>
                      )}
                    </div>

                    {/* Bottom Track Title & Artist Overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-4">
                      <p className="text-[11px] font-bold text-white truncate leading-tight">
                        {t.title}
                      </p>
                      <p className="text-[9px] text-white/70 truncate mt-0.5 leading-tight">
                        {t.artist}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Playlist Title */}
              <h3 className="text-xl font-bold text-white tracking-tight truncate">
                {sp.title}
              </h3>

              {/* Bottom Row: Songs Count, Duration & Play/Pause Pill Button */}
              <div className="flex items-center justify-between pt-1">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-neutral-300 tracking-wide">
                    {sp.songCountText}
                  </p>
                  <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                    {sp.durationText}
                  </p>
                </div>

                <button
                  onClick={() => {
                    triggerHaptic("tap");
                    if (isThisActive) {
                      togglePlayPause();
                    } else {
                      setActivePlayId(sp.id);
                      if (allTracks.length > 0) {
                        playTrack(allTracks[0], allTracks, {
                          type: "PLAYLIST",
                          title: sp.title,
                        });
                      }
                    }
                  }}
                  className={`h-10 px-5 rounded-full font-bold text-xs flex items-center gap-2 active:scale-95 transition-all cursor-pointer shadow-lg ${
                    isThisActive || (sp.isPlayingInitially && isPlaying)
                      ? "bg-gradient-to-r from-[#f95721] to-[#ff6b35] text-white shadow-[0_4px_16px_rgba(249,87,33,0.45)]"
                      : "bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white"
                  }`}
                >
                  {isThisActive || (sp.isPlayingInitially && isPlaying) ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <span>Play All</span>
                      <Play className="w-3 h-3 fill-[#f95721] text-[#f95721]" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* User-Created Custom Playlists */}
        {playlists.map((pl) => {
          const plTracks = pl.trackIds
            .map((id) => tracksById.get(id))
            .filter(Boolean) as MusicTrack[];

          const isThisPlaylistPlaying =
            sourceContext?.type === "PLAYLIST" &&
            sourceContext?.title === pl.title &&
            isPlaying;

          return (
            <div
              key={pl.id}
              className="relative overflow-hidden rounded-[28px] bg-[#121215] border border-white/[0.06] p-4.5 space-y-4 shadow-xl hover:border-white/[0.12] transition-colors"
            >
              {plTracks.length > 0 ? (
                <div className="grid grid-cols-3 gap-2.5">
                  {[0, 1, 2].map((idx) => {
                    const trk = plTracks[idx];
                    if (!trk) {
                      return (
                        <div
                          key={`empty_${idx}`}
                          className="aspect-square rounded-2xl bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center text-neutral-600"
                        >
                          <Music className="w-5 h-5 opacity-30" />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={trk.id}
                        onClick={() => {
                          triggerHaptic("tap");
                          playTrack(trk, plTracks, {
                            type: "PLAYLIST",
                            title: pl.title,
                          });
                        }}
                        className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 border border-white/[0.08] cursor-pointer active:scale-95 transition-transform"
                      >
                        {trk.artworkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={trk.artworkUrl}
                            alt={trk.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-white/30">
                            <Music className="w-6 h-6" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-4">
                          <p className="text-[11px] font-bold text-white truncate leading-tight">
                            {trk.title}
                          </p>
                          <p className="text-[9px] text-white/70 truncate mt-0.5 leading-tight">
                            {trk.artist || "Artist"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Link
                  href={`/secret/music/playlists/${pl.id}`}
                  className="block py-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-neutral-400 hover:border-white/20 hover:text-neutral-300 transition-colors"
                >
                  Playlist is empty · Tap to view and add songs
                </Link>
              )}

              <Link
                href={`/secret/music/playlists/${pl.id}`}
                onClick={() => triggerHaptic("tap")}
                className="block group"
              >
                <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-[#f95721] transition-colors truncate">
                  {pl.title}
                </h3>
              </Link>

              <div className="flex items-center justify-between pt-1">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-neutral-300 tracking-wide">
                    {plTracks.length} Songs
                  </p>
                </div>

                <button
                  onClick={() => {
                    triggerHaptic("tap");
                    if (isThisPlaylistPlaying) {
                      togglePlayPause();
                    } else if (plTracks.length > 0) {
                      playTrack(plTracks[0], plTracks, {
                        type: "PLAYLIST",
                        title: pl.title,
                      });
                    }
                  }}
                  className="h-10 px-5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white font-bold text-xs flex items-center gap-2 active:scale-95 transition-all cursor-pointer shadow-lg"
                >
                  <span>Play All</span>
                  <Play className="w-3 h-3 fill-[#f95721] text-[#f95721]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Playlist Modal Sheet */}
      <Sheet open={creating} onClose={() => setCreating(false)}>
        <form onSubmit={create} className="space-y-4 px-1">
          <h3 className="font-display text-2xl text-white">Create New Playlist</h3>
          <p className="text-xs text-neutral-400">
            Give your playlist a name and start curating your sound.
          </p>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Midnight Mirage, Road Trip Beats…"
            className="w-full h-14 px-5 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#f95721]"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#f95721] to-[#ff6b35] text-white font-bold disabled:opacity-40 active:scale-[0.98] transition-all cursor-pointer shadow-[0_8px_20px_rgba(249,87,33,0.35)]"
          >
            Create Playlist
          </button>
        </form>
      </Sheet>
    </div>
  );
}
