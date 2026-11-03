"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Plus,
  Mic,
  Search,
  ChevronRight,
  Music,
  X,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import {
  Artwork,
  TrackRow,
  TrackActionSheet,
  formatTime,
  openAddSheet,
  useLibraryRefresh,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";
import CategoryTabs from "@/components/music/CategoryTabs";

interface HeroCardItem {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  subtitle: string;
  tracksLabel?: string;
  trackRef?: MusicTrack;
}

// Reference featured hero cards matching Image 2
const EDITORIAL_HERO_CARDS: Omit<HeroCardItem, "trackRef">[] = [
  {
    id: "hero_starboy",
    title: "Starboy",
    artist: "The Weeknd",
    artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=700&auto=format&fit=crop&q=80",
    subtitle: "Late night drives & pulse rhythms",
    tracksLabel: "28 Tracks",
  },
  {
    id: "hero_birds",
    title: "Birds of a feather",
    artist: "Billie Eilish",
    artworkUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    subtitle: "Based on your 8AM gym session",
  },
  {
    id: "hero_calm_down",
    title: "Calm Down",
    artist: "Rema",
    artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=700&auto=format&fit=crop&q=80",
    subtitle: "Golden hour energy & sunlit beats",
    tracksLabel: "16 Tracks",
  },
];

function getGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return "Morning";
  if (hr < 17) return "Afternoon";
  return "Evening";
}

function NebulaPlanetIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <path d="M4 14.5C2.5 13 4 10.5 8 9.5C12 8.5 18 8 20.5 10C22 11.5 20.5 14 16.5 15C12.5 16 6.5 16.5 4 14.5Z" />
    </svg>
  );
}

export default function MusicHomePage() {
  const router = useRouter();
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [greeting] = useState(getGreeting);
  const carouselRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => b.addedAt - a.addedAt),
    [tracks]
  );

  // Search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return sortedTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist || "").toLowerCase().includes(q)
    );
  }, [sortedTracks, searchQuery]);

  // Combine real tracks with hero cards
  const heroCards = useMemo<HeroCardItem[]>(() => {
    // If user has tracks in their library, display their tracks!
    if (sortedTracks.length > 0) {
      const active = currentTrack || sortedTracks[0];
      const second = sortedTracks[1] || sortedTracks[0];
      const third = sortedTracks[2] || sortedTracks[0];

      return [
        {
          id: second.id,
          title: second.title,
          artist: second.artist || "Artist",
          artworkUrl: second.artworkUrl || EDITORIAL_HERO_CARDS[0].artworkUrl,
          subtitle: "Recent heavy rotation",
          tracksLabel: `${sortedTracks.length} Tracks`,
          trackRef: second,
        },
        {
          id: active.id,
          title: active.title,
          artist: active.artist || "Artist",
          artworkUrl: active.artworkUrl || EDITORIAL_HERO_CARDS[1].artworkUrl,
          subtitle: "Based on your 8AM gym session",
          trackRef: active,
        },
        {
          id: third.id,
          title: third.title,
          artist: third.artist || "Artist",
          artworkUrl: third.artworkUrl || EDITORIAL_HERO_CARDS[2].artworkUrl,
          subtitle: "Golden hour energy & sunlit beats",
          tracksLabel: `${sortedTracks.length} Tracks`,
          trackRef: third,
        },
      ];
    }

    return EDITORIAL_HERO_CARDS;
  }, [sortedTracks, currentTrack]);

  // Center hero carousel
  useEffect(() => {
    if (carouselRef.current) {
      const container = carouselRef.current;
      const cardWidth = container.offsetWidth * 0.75;
      container.scrollLeft = cardWidth * 0.7;
    }
  }, [heroCards]);

  const handleHeroCardClick = (card: HeroCardItem) => {
    triggerHaptic("tap");
    if (card.trackRef) {
      if (currentTrack?.id === card.trackRef.id) {
        togglePlayPause();
      } else {
        playTrack(card.trackRef, sortedTracks, { type: "LIBRARY", title: "Spotlight" });
      }
    } else if (sortedTracks.length > 0) {
      playTrack(sortedTracks[0], sortedTracks, { type: "LIBRARY", title: "Spotlight" });
    } else {
      openAddSheet();
    }
  };

  const handlePlayAllDayStarter = () => {
    triggerHaptic("tap");
    if (sortedTracks.length > 0) {
      playTrack(sortedTracks[0], sortedTracks, {
        type: "LIBRARY",
        title: "Day-Starter Beats",
      });
    } else {
      openAddSheet();
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-fade-in select-none">
      {/* 1. Brand Top Bar: 🪐 NEBULA + User Profile & Add Button */}
      <header className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2 text-white">
          <NebulaPlanetIcon className="w-6 h-6 text-white" />
          <span className="font-extrabold text-lg tracking-[0.2em] uppercase text-white font-display">
            NEBULA
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              triggerHaptic("tap");
              openAddSheet();
            }}
            className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center text-white cursor-pointer active:scale-95 transition-all"
            aria-label="Add music"
            title="Add Music"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>

          {/* Circular Profile Avatar with glowing ambient ring */}
          <Link
            href="/secret"
            onClick={() => triggerHaptic("tap")}
            className="relative group p-0.5 rounded-full"
            aria-label="User Profile"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#f95721]/50 shadow-[0_0_12px_rgba(249,87,33,0.4)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>
        </div>
      </header>

      {/* 2. Search / Voice Capsule Pill (Exact Image 2) */}
      <div className="relative">
        <div className="h-14 rounded-full bg-[#121215]/90 border border-[#f95721]/30 backdrop-blur-xl px-5 flex items-center justify-between shadow-[0_0_24px_rgba(249,87,33,0.08)] transition-all focus-within:border-[#f95721] focus-within:shadow-[0_0_28px_rgba(249,87,33,0.2)]">
          <div className="flex-1 flex items-center gap-2 min-w-0 pr-3">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${greeting}, Anu!, What's your pick?`}
              className="w-full bg-transparent text-sm font-medium text-white placeholder:text-neutral-500 focus:outline-none"
            />
          </div>

          {searchQuery ? (
            <button
              onClick={() => {
                triggerHaptic("tap");
                setSearchQuery("");
              }}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer active:scale-90"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                triggerHaptic("tap");
                searchInputRef.current?.focus();
              }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-white via-[#ff7a45] to-[#f95721] p-[2px] shadow-[0_0_16px_rgba(249,87,33,0.45)] active:scale-90 transition-transform cursor-pointer shrink-0 flex items-center justify-center"
              aria-label="Search or voice"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#ff6b35] to-[#f95721] flex items-center justify-center">
                <Mic className="w-4.5 h-4.5 text-white stroke-[2.2]" />
              </div>
            </button>
          )}
        </div>

        {/* Real-time search results drop-down */}
        {searchQuery.trim().length > 0 && (
          <div className="mt-3 rounded-[24px] bg-[#141418] border border-white/10 p-2 space-y-1 shadow-2xl">
            {searchResults.length > 0 ? (
              searchResults.slice(0, 5).map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  onPlay={() => {
                    playTrack(track, searchResults, {
                      type: "LIBRARY",
                      title: `Search: ${searchQuery}`,
                    });
                    setSearchQuery("");
                  }}
                  onMore={() => setSheetTrack(track)}
                />
              ))
            ) : (
              <p className="text-center py-4 text-xs text-neutral-400">
                No songs found matching &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Category Navigation Tabs */}
      <CategoryTabs />

      {/* 4. Hero Carousel Section (Exact Image 2) */}
      <section className="relative -mx-4 px-4 overflow-hidden">
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {heroCards.map((card, idx) => {
            const isCenterCard = idx === 1;
            const isTrackCurrentlyPlaying =
              currentTrack &&
              card.trackRef &&
              currentTrack.id === card.trackRef.id &&
              isPlaying;

            return (
              <div
                key={card.id}
                className={`shrink-0 snap-center transition-all duration-300 ${
                  isCenterCard
                    ? "w-[78vw] max-w-[340px]"
                    : "w-[65vw] max-w-[270px] opacity-75 scale-95"
                }`}
              >
                {/* Hero Card Container */}
                <div
                  className="relative aspect-[4/5] rounded-[32px] overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl group cursor-pointer"
                  onClick={() => handleHeroCardClick(card)}
                >
                  {/* Artwork Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.artworkUrl}
                    alt={card.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />

                  {/* Gradient Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/30 pointer-events-none" />

                  {/* Top Right: Glass Circular '+' Button */}
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("tap");
                        openAddSheet();
                      }}
                      className="w-10 h-10 rounded-full bg-black/40 border border-white/20 backdrop-blur-md text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg cursor-pointer hover:bg-black/60"
                      aria-label="Add Track"
                    >
                      <Plus className="w-5 h-5 stroke-[2.2]" />
                    </button>
                  </div>

                  {/* Center: Frosted Glass Circular Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHeroCardClick(card);
                      }}
                      className="w-16 h-16 rounded-full bg-white/85 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex items-center justify-center text-black active:scale-90 group-hover:scale-105 transition-all cursor-pointer"
                      aria-label={isTrackCurrentlyPlaying ? "Pause" : "Play"}
                    >
                      {isTrackCurrentlyPlaying ? (
                        <Pause className="w-7 h-7 fill-black text-black" />
                      ) : (
                        <Play className="w-7 h-7 fill-black text-black ml-1" />
                      )}
                    </button>
                  </div>

                  {/* Bottom Text Overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-5 z-10">
                    <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight truncate">
                      {card.title}
                    </h3>
                    <p className="text-sm font-medium text-neutral-300 truncate mt-1">
                      {card.artist}
                    </p>
                  </div>
                </div>

                {/* Subtitle / Context Note Underneath the Card */}
                <div className="mt-3 px-1 text-center">
                  <p className="text-xs font-semibold text-neutral-400">
                    {card.subtitle}
                  </p>
                  {card.tracksLabel && (
                    <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {card.tracksLabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Section: "Day-Starter Beats" (Exact Image 2) */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-none">
              Day-Starter
            </h2>
            <h3 className="text-xl sm:text-2xl font-bold text-neutral-400 tracking-tight leading-tight">
              Beats
            </h3>
          </div>

          {/* Radiant Sunset Orange Pill: ▶ Play All */}
          <button
            onClick={handlePlayAllDayStarter}
            className="h-11 px-5 rounded-full bg-gradient-to-r from-[#f95721] to-[#ff6b35] text-white font-bold text-sm shadow-[0_6px_22px_rgba(249,87,33,0.45)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Play All</span>
          </button>
        </div>

        {/* Day-Starter Track Cards List */}
        {sortedTracks.length > 0 ? (
          <div className="rounded-[28px] bg-[#121215] border border-white/[0.06] p-2 space-y-1">
            {sortedTracks.slice(0, 5).map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                onPlay={() =>
                  playTrack(track, sortedTracks, {
                    type: "LIBRARY",
                    title: "Day-Starter Beats",
                  })
                }
                onMore={() => setSheetTrack(track)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-[#121215] border border-white/[0.06] p-5 text-center">
            <p className="text-sm font-semibold text-white">Your library is ready</p>
            <p className="text-xs text-neutral-400 mt-1">
              Add your favorite tunes or sync your cloud vault to activate Day-Starter Beats.
            </p>
            <button
              onClick={openAddSheet}
              className="mt-3.5 px-4.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-xs font-semibold text-white cursor-pointer active:scale-95 transition-all"
            >
              Add Music
            </button>
          </div>
        )}
      </section>

      {/* 6. Section: "Podcast Picks" Card (Exact Image 2) */}
      <section className="pt-1">
        <div className="rounded-[28px] bg-[#121215] border border-white/[0.06] p-4.5 flex items-center justify-between shadow-xl">
          <div>
            <h4 className="text-lg font-bold text-white tracking-tight">Podcast Picks</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              {sortedTracks.length > 0 ? `${sortedTracks.length} Tracks` : "28 Tracks"}
            </p>
          </div>

          <Link
            href="/secret/music/library"
            onClick={() => triggerHaptic("tap")}
            className="px-4.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white transition-all active:scale-95 cursor-pointer"
          >
            View All
          </Link>
        </div>
      </section>

      {/* Track Action Modal Sheet */}
      <TrackActionSheet
        track={sheetTrack}
        onClose={() => setSheetTrack(null)}
        onChanged={load}
      />
    </div>
  );
}
