"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Search, SlidersHorizontal, Music, Play, Check } from "lucide-react";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import { Sheet, TrackRow, TrackActionSheet, useLibraryRefresh, openAddSheet } from "@/components/music/ui";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { triggerHaptic } from "@/lib/deviceAuth";
import CategoryTabs from "@/components/music/CategoryTabs";

interface ArtistCardData {
  name: string;
  role: string;
  listeners: string;
  country: string;
  artworkUrl: string;
  badge?: string;
  tracks: MusicTrack[];
}

// Reference featured artists exactly matching Image 3
const SHOWCASE_ARTISTS: Omit<ArtistCardData, "tracks">[] = [
  {
    name: "Hanumankind",
    role: "Rapper and singer",
    listeners: "28,340 Listeners",
    country: "British",
    artworkUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Rema",
    role: "Rapper and singer",
    listeners: "22,240 Listeners",
    country: "Nigeria",
    artworkUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Dua Lipa",
    role: "Singer",
    listeners: "45,320 Listeners",
    country: "British",
    badge: "1258 Artist",
    artworkUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Billie Eilish",
    role: "Singer",
    listeners: "68,120 Listeners",
    country: "USA",
    artworkUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "The Weeknd",
    role: "Rapper and singer",
    listeners: "12,243 Listeners",
    country: "Canada",
    artworkUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80",
  },
  {
    name: "Zayn Malik",
    role: "Singer",
    listeners: "31,800 Listeners",
    country: "English",
    artworkUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80",
  },
];

export default function ArtistsPage() {
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<ArtistCardData | null>(null);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);
  const [sortMode, setSortMode] = useState<"listeners" | "name">("listeners");
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

  // Group tracks by artist
  const artistsList = useMemo<ArtistCardData[]>(() => {
    const map = new Map<string, MusicTrack[]>();
    for (const t of tracks) {
      const artistName = (t.artist || "Unknown Artist").trim();
      if (!map.has(artistName)) map.set(artistName, []);
      map.get(artistName)!.push(t);
    }

    const list: ArtistCardData[] = [];

    // First add showcase artists
    for (const sc of SHOWCASE_ARTISTS) {
      const matchingTracks = map.get(sc.name) || [];
      list.push({
        ...sc,
        tracks: matchingTracks,
      });
    }

    // Then add any additional artists from user library
    map.forEach((artistTracks, name) => {
      if (!list.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
        const totalPlays = artistTracks.reduce((acc, t) => acc + (t.playCount || 0), 0);
        list.push({
          name,
          role: artistTracks[0]?.genre ? `${artistTracks[0].genre} Artist` : "Singer",
          listeners: `${(artistTracks.length * 2800 + totalPlays * 120 + 450).toLocaleString()} Listeners`,
          country: "Global",
          artworkUrl: artistTracks.find((t) => t.artworkUrl)?.artworkUrl || SHOWCASE_ARTISTS[0].artworkUrl,
          tracks: artistTracks,
        });
      }
    });

    return list;
  }, [tracks]);

  // Filter and sort artists
  const filteredArtists = useMemo(() => {
    let result = artistsList;
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q)
      );
    }

    if (sortMode === "name") {
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [artistsList, query, sortMode]);

  const handleArtistClick = (artist: ArtistCardData) => {
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
    <div className="space-y-5 pb-32 animate-fade-in relative min-h-screen select-none">
      {/* Top Category Tabs */}
      <CategoryTabs />

      {/* 2-Column Artist Card Grid (Exact Image 3) */}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={artist.artworkUrl}
                  alt={artist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                {/* Optional Floating Top Tag / Badge (e.g. 1258 Artist) */}
                {artist.badge && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-white/90 shadow-md">
                    {artist.badge}
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
                {/* Artist Name + Orange Verified Badge (Exact Image 3) */}
                <div className="flex items-center gap-1.5">
                  <h4 className="text-[15px] font-bold text-white tracking-tight truncate group-hover:text-[#f95721] transition-colors">
                    {artist.name}
                  </h4>
                  <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-[#f95721] flex items-center justify-center shadow-sm">
                    <Check className="w-2.5 h-2.5 stroke-[3] text-white" />
                  </span>
                </div>

                <p className="text-xs text-neutral-400 font-medium truncate">
                  {artist.role}
                </p>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-0.5">
                  <span className="truncate">{artist.listeners}</span>
                  <span className="shrink-0 ml-1 font-medium text-neutral-400">
                    {artist.country}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredArtists.length === 0 && (
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

      {/* Floating Bottom Bar: Capsule Search + Floating Orange Equalizer Button (Exact Image 3) */}
      <div className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] inset-x-4 max-w-md mx-auto z-20 flex items-center gap-3">
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
          aria-label="Sort or filter artists"
        >
          <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      {/* Artist Track Sheet */}
      <Sheet open={Boolean(selectedArtist)} onClose={() => setSelectedArtist(null)}>
        {selectedArtist && (
          <div className="space-y-4 px-1 pb-2">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-800 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedArtist.artworkUrl}
                  alt={selectedArtist.name}
                  className="w-full h-full object-cover"
                />
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
                  {selectedArtist.role} · {selectedArtist.country}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {selectedArtist.tracks.length} songs in library
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
              <div className="p-4 rounded-2xl bg-white/[0.04] text-center text-xs text-neutral-400 space-y-2">
                <p>No local songs for {selectedArtist.name} yet.</p>
                <button
                  onClick={() => {
                    setSelectedArtist(null);
                    openAddSheet();
                  }}
                  className="px-4 py-2 rounded-full bg-[#f95721] text-white font-bold text-xs"
                >
                  Import {selectedArtist.name} Songs
                </button>
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
                setSortMode("listeners");
                setFilterSheetOpen(false);
              }}
              className={`w-full p-3.5 rounded-2xl border text-left text-sm font-semibold flex items-center justify-between transition-colors ${
                sortMode === "listeners"
                  ? "bg-[#f95721]/15 border-[#f95721] text-white"
                  : "bg-white/[0.04] border-white/10 text-neutral-300"
              }`}
            >
              <span>Most Popular (Listeners)</span>
              {sortMode === "listeners" && <Check className="w-4 h-4 text-[#f95721]" />}
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

      {/* Track Action Sheet */}
      <TrackActionSheet
        track={sheetTrack}
        onClose={() => setSheetTrack(null)}
        onChanged={load}
      />
    </div>
  );
}
