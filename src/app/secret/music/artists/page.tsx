"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Search, SlidersHorizontal, Music, Play, Check } from "lucide-react";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import { Sheet, TrackRow, TrackActionSheet, useLibraryRefresh, openAddSheet, EmptyState } from "@/components/music/ui";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { triggerHaptic } from "@/lib/deviceAuth";
import CategoryTabs from "@/components/music/CategoryTabs";

interface ArtistProfile {
  name: string;
  role: string;
  stats: string;
  genre: string;
  artworkUrl?: string;
  tracks: MusicTrack[];
}

export default function ArtistsPage() {
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<ArtistProfile | null>(null);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);
  const [sortMode, setSortMode] = useState<"count" | "name">("count");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await getAllTracks();
      setTracks(all);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLibraryRefresh(load);

  // Group real library tracks by artist
  const libraryArtists = useMemo(() => {
    const map = new Map<string, MusicTrack[]>();
    for (const t of tracks) {
      const artistName = (t.artist || "Unknown Artist").trim();
      if (!map.has(artistName)) map.set(artistName, []);
      map.get(artistName)!.push(t);
    }

    const list: ArtistProfile[] = [];
    map.forEach((artistTracks, name) => {
      const totalPlays = artistTracks.reduce((acc, trk) => acc + (trk.playCount || 0), 0);
      const topGenre = artistTracks.find((t) => t.genre)?.genre || "Music";

      list.push({
        name,
        role: `${artistTracks.length} song${artistTracks.length > 1 ? "s" : ""}`,
        stats: `${totalPlays} play${totalPlays !== 1 ? "s" : ""}`,
        genre: topGenre,
        artworkUrl: artistTracks.find((t) => t.artworkUrl)?.artworkUrl,
        tracks: artistTracks,
      });
    });

    return list;
  }, [tracks]);

  // Filter and sort artists
  const filteredArtists = useMemo(() => {
    let result = libraryArtists;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.genre.toLowerCase().includes(q)
      );
    }

    if (sortMode === "name") {
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...result].sort((a, b) => b.tracks.length - a.tracks.length);
  }, [libraryArtists, query, sortMode]);

  const handleArtistClick = (artist: ArtistProfile) => {
    triggerHaptic("tap");
    if (artist.tracks.length > 0) {
      playTrack(artist.tracks[0], artist.tracks, {
        type: "ARTIST",
        title: artist.name,
      });
    }
    setSelectedArtist(artist);
  };

  return (
    <div className="space-y-5 pb-36 animate-fade-in relative min-h-screen select-none">
      {/* Top Category Tabs */}
      <CategoryTabs />

      {/* 2-Column Artist Card Grid */}
      {loaded && libraryArtists.length === 0 ? (
        <div className="rounded-[28px] bg-[#121215] border border-white/[0.06] p-6 text-center">
          <EmptyState
            title="No artists yet"
            body="Add songs to your vault to automatically organize and explore your library by artist."
            cta="Add Music"
            onCta={openAddSheet}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 pt-1">
          {filteredArtists.map((artist) => {
            const isCurrentArtistPlaying =
              currentTrack &&
              currentTrack.artist?.toLowerCase() === artist.name.toLowerCase() &&
              isPlaying;

            return (
              <div
                key={artist.name}
                onClick={() => handleArtistClick(artist)}
                className="group cursor-pointer active:scale-[0.97] transition-transform select-none"
              >
                {/* Artist Artwork Card */}
                <div className="relative aspect-square w-full rounded-[26px] overflow-hidden bg-neutral-900 border border-white/[0.06] shadow-lg">
                  {artist.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artist.artworkUrl}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-white/30">
                      <Music className="w-10 h-10" />
                    </div>
                  )}

                  {/* Playing indicator overlay */}
                  {isCurrentArtistPlaying && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#f95721] text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Artist Details */}
                <div className="mt-2.5 px-0.5 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[15px] font-bold text-white tracking-tight truncate group-hover:text-[#f95721] transition-colors">
                      {artist.name}
                    </h4>
                    {/* Verified Check Badge */}
                    <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-[#f95721] flex items-center justify-center shadow-sm">
                      <Check className="w-2.5 h-2.5 stroke-[3] text-white" />
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 font-medium truncate">
                    {artist.role}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-0.5">
                    <span className="truncate">{artist.stats}</span>
                    <span className="shrink-0 ml-1 font-medium text-neutral-400">
                      {artist.genre}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loaded && libraryArtists.length > 0 && filteredArtists.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          <p className="text-sm font-semibold">No artists match &ldquo;{query}&rdquo;</p>
          <button
            onClick={() => setQuery("")}
            className="mt-2 text-xs text-[#f95721] hover:underline cursor-pointer"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Floating Bottom Bar: Capsule Search + Floating Orange Equalizer Button */}
      {libraryArtists.length > 0 && (
        <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5.2rem)] inset-x-4 max-w-md mx-auto z-20 flex items-center gap-3">
          <div className="flex-1 h-13 rounded-full bg-[#121215]/95 border border-white/10 backdrop-blur-2xl px-4.5 flex items-center justify-between shadow-[0_12px_32px_rgba(0,0,0,0.7)] group focus-within:border-[#f95721]/50 transition-colors">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Artists"
              className="w-full bg-transparent text-sm font-medium text-white placeholder:text-neutral-500 focus:outline-none"
            />
            <Search className="w-4.5 h-4.5 text-neutral-400 shrink-0 ml-2" />
          </div>

          <button
            onClick={() => {
              triggerHaptic("tap");
              setFilterSheetOpen(true);
            }}
            className="w-13 h-13 rounded-full bg-gradient-to-br from-[#f95721] to-[#ff6b35] text-white flex items-center justify-center shadow-[0_8px_25px_rgba(249,87,33,0.5)] active:scale-90 transition-transform cursor-pointer shrink-0"
            aria-label="Filter or Sort Artists"
          >
            <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      )}

      {/* Artist Track Sheet */}
      <Sheet open={Boolean(selectedArtist)} onClose={() => setSelectedArtist(null)}>
        {selectedArtist && (
          <div className="space-y-4 px-1 pb-2">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-800 shrink-0">
                {selectedArtist.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedArtist.artworkUrl}
                    alt={selectedArtist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-6 h-6 text-white/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-xl text-white truncate">
                    {selectedArtist.name}
                  </h3>
                  <span className="w-3.5 h-3.5 rounded-full bg-[#f95721] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3] text-white" />
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {selectedArtist.role} · {selectedArtist.stats}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Genre: {selectedArtist.genre}
                </p>
              </div>
            </div>

            {selectedArtist.tracks.length > 0 ? (
              <div className="rounded-2xl bg-white/[0.04] p-1.5 space-y-0.5 max-h-72 overflow-y-auto">
                {selectedArtist.tracks.map((t, idx) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    index={idx}
                    onPlay={() =>
                      playTrack(t, selectedArtist.tracks, {
                        type: "ARTIST",
                        title: selectedArtist.name,
                      })
                    }
                    onMore={() => setSheetTrack(t)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white/[0.04] text-center text-xs text-neutral-400">
                No songs for this artist yet.
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* Filter / Sort Sheet */}
      <Sheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)}>
        <div className="space-y-4 px-1">
          <h3 className="font-display text-xl text-white">Sort Artists</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                triggerHaptic("tap");
                setSortMode("count");
                setFilterSheetOpen(false);
              }}
              className={`w-full p-3.5 rounded-2xl border text-left text-sm font-semibold flex items-center justify-between transition-colors ${
                sortMode === "count"
                  ? "bg-[#f95721]/15 border-[#f95721] text-white"
                  : "bg-white/[0.04] border-white/10 text-neutral-300"
              }`}
            >
              <span>Most Songs</span>
              {sortMode === "count" && <Check className="w-4 h-4 text-[#f95721]" />}
            </button>

            <button
              onClick={() => {
                triggerHaptic("tap");
                setSortMode("name");
                setFilterSheetOpen(false);
              }}
              className={`w-full p-3.5 rounded-2xl border text-left text-sm font-semibold flex items-center justify-between transition-colors ${
                sortMode === "name"
                  ? "bg-[#f95721]/15 border-[#f95721] text-white"
                  : "bg-white/[0.04] border-white/10 text-neutral-300"
              }`}
            >
              <span>Alphabetical (A - Z)</span>
              {sortMode === "name" && <Check className="w-4 h-4 text-[#f95721]" />}
            </button>
          </div>
        </div>
      </Sheet>

      {/* Track Action Modal Sheet */}
      <TrackActionSheet
        track={sheetTrack}
        onClose={() => setSheetTrack(null)}
        onChanged={load}
      />
    </div>
  );
}
