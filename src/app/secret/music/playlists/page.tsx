"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Play, Pause, Music, Disc, Sparkles } from "lucide-react";
import { getAllPlaylists, savePlaylist, getAllTracks } from "@/lib/music/storage";
import { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import { Sheet, EmptyState, useLibraryRefresh, Artwork, Equalizer } from "@/components/music/ui";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { triggerHaptic } from "@/lib/deviceAuth";
import CategoryTabs from "@/components/music/CategoryTabs";

export default function PlaylistsPage() {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, sourceContext } = useMusicPlayer();
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [allTracks, setAllTracks] = useState<MusicTrack[]>([]);
  const [tracksById, setTracksById] = useState<Map<string, MusicTrack>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const [pls, tracks] = await Promise.all([getAllPlaylists(), getAllTracks()]);
      setAllTracks(tracks);
      const map = new Map(tracks.map((t) => [t.id, t]));
      setTracksById(map);

      // If library has songs but no playlists exist, auto-seed starter playlists like "Road Trip Anthems" & "Desert Mirage Fusion"
      if (pls.length === 0 && tracks.length > 0) {
        const starter1: MusicPlaylist = {
          id: `pl_road_trip_${Date.now()}`,
          title: "Road Trip Anthems",
          trackIds: tracks.slice(0, 8).map((t) => t.id),
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 86400000,
        };
        const starter2: MusicPlaylist = {
          id: `pl_desert_mirage_${Date.now() + 1}`,
          title: "Desert Mirage Fusion",
          trackIds: tracks.slice(2, 10).map((t) => t.id),
          createdAt: Date.now() - 43200000,
          updatedAt: Date.now() - 43200000,
        };
        await Promise.all([savePlaylist(starter1), savePlaylist(starter2)]);
        setPlaylists([starter1, starter2]);
      } else {
        setPlaylists(pls);
      }
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

  // Format total duration for playlist
  const getPlaylistDurationFormatted = (plTracks: MusicTrack[]) => {
    const totalSecs = plTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0) {
      return `${hrs} hour${hrs > 1 ? "s" : ""} ${mins} Minute${mins !== 1 ? "s" : ""}`;
    }
    return `${mins || 1} Minutes`;
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      {/* Top category navigation strip */}
      <CategoryTabs />

      {/* Playlists Header */}
      <header className="flex items-center justify-between px-1 pt-1">
        <div>
          <span className="block text-3xl font-extrabold text-white tracking-tight">
            {playlists.length}
          </span>
          <span className="block text-2xl font-bold text-white/90 tracking-tight">
            Playlists
          </span>
        </div>

        {/* Create New Playlist button with circular orange border */}
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

      {/* Playlist List / Empty State */}
      {loaded && playlists.length === 0 ? (
        <div className="rounded-[28px] bg-[#121215] border border-white/[0.06] p-6 text-center">
          <EmptyState
            title="No playlists yet"
            body="Group your favorite songs into road trips, midnight chill, or gym workouts."
            cta="Create First Playlist"
            onCta={() => setCreating(true)}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {playlists.map((pl) => {
            const plTracks = pl.trackIds
              .map((id) => tracksById.get(id))
              .filter(Boolean) as MusicTrack[];

            // Pick 3 tracks for the thumbnail collage (or fallback to general tracks if playlist is empty)
            const previewTracks: (MusicTrack | null)[] = [
              plTracks[0] || allTracks[0] || null,
              plTracks[1] || allTracks[1] || null,
              plTracks[2] || allTracks[2] || null,
            ];

            const isThisPlaylistPlaying =
              sourceContext?.type === "PLAYLIST" &&
              sourceContext?.title === pl.title &&
              isPlaying;

            const handlePlayPlaylist = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              triggerHaptic("tap");

              if (isThisPlaylistPlaying) {
                togglePlayPause();
                return;
              }

              const tracksToPlay = plTracks.length > 0 ? plTracks : allTracks;
              if (tracksToPlay.length > 0) {
                playTrack(tracksToPlay[0], tracksToPlay, {
                  type: "PLAYLIST",
                  title: pl.title,
                });
              }
            };

            const durationText = getPlaylistDurationFormatted(plTracks);
            const songIndexText = plTracks.length > 0 ? `01 / ${plTracks.length} Songs` : "0 Songs";

            return (
              <div
                key={pl.id}
                className="relative overflow-hidden rounded-[28px] bg-[#121215] border border-white/[0.06] p-4.5 space-y-4 shadow-xl hover:border-white/[0.12] transition-colors"
              >
                {/* 3 Square Track Thumbnails Collage Side by Side */}
                <div className="grid grid-cols-3 gap-2.5">
                  {previewTracks.map((trk, idx) => {
                    const isTrackActive = currentTrack && trk && currentTrack.id === trk.id;
                    const isThisTrackPlaying = isTrackActive && isPlaying;

                    return (
                      <div
                        key={trk?.id || `preview_${idx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (trk) {
                            triggerHaptic("tap");
                            const playListContext = plTracks.length > 0 ? plTracks : allTracks;
                            playTrack(trk, playListContext, {
                              type: "PLAYLIST",
                              title: pl.title,
                            });
                          }
                        }}
                        className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-900 border border-white/[0.08] cursor-pointer active:scale-95 transition-transform"
                      >
                        {trk?.artworkUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={trk.artworkUrl}
                            alt={trk.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                            <Music className="w-6 h-6 text-white/30" />
                          </div>
                        )}

                        {/* Center Icon Overlay (Play or Equalizer Waveform) */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isThisTrackPlaying ? (
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
                            {trk?.title || `Track ${idx + 1}`}
                          </p>
                          <p className="text-[9px] text-white/70 truncate mt-0.5 leading-tight">
                            {trk?.artist || "Artist"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Playlist Title */}
                <Link
                  href={`/secret/music/playlists/${pl.id}`}
                  onClick={() => triggerHaptic("tap")}
                  className="block group"
                >
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-[#f95721] transition-colors truncate">
                    {pl.title}
                  </h3>
                </Link>

                {/* Bottom Row: Songs Count, Duration & Play/Pause Pill Button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-neutral-300 tracking-wide">
                      {songIndexText}
                    </p>
                    <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                      {durationText}
                    </p>
                  </div>

                  <button
                    onClick={handlePlayPlaylist}
                    className={`h-10 px-5 rounded-full font-bold text-xs flex items-center gap-2 active:scale-95 transition-all cursor-pointer shadow-lg ${
                      isThisPlaylistPlaying
                        ? "bg-gradient-to-r from-[#f95721] to-[#ff6b35] text-white shadow-[0_4px_16px_rgba(249,87,33,0.45)]"
                        : "bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white"
                    }`}
                  >
                    {isThisPlaylistPlaying ? (
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
        </div>
      )}

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
