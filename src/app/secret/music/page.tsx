"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Plus,
  Search,
  ChevronRight,
  Flame,
  Clock,
  Heart,
  HardDriveDownload,
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
  EmptyState,
  formatTime,
  hasLocalAudio,
  openAddSheet,
  useLibraryRefresh,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";
import CategoryTabs from "@/components/music/CategoryTabs";
import MusicWidgetsSection from "@/components/music/MusicWidgetsSection";

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

  const counts = useMemo(
    () => ({
      liked: tracks.filter((t) => t.isFavorite).length,
      offline: tracks.filter(hasLocalAudio).length,
      recent: tracks.filter((t) => t.lastPlayedAt).length,
      top: tracks.filter((t) => (t.playCount || 0) > 0).length,
    }),
    [tracks]
  );

  // Real-time search filtered tracks
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return sortedTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist || "").toLowerCase().includes(q) ||
        (t.album || "").toLowerCase().includes(q)
    );
  }, [sortedTracks, searchQuery]);

  // Real library tracks for the Hero Carousel
  const heroTracks = useMemo<MusicTrack[]>(() => {
    if (sortedTracks.length === 0) return [];
    const list: MusicTrack[] = [];
    if (currentTrack) {
      list.push(currentTrack);
    }
    for (const t of sortedTracks) {
      if (!list.some((existing) => existing.id === t.id)) {
        list.push(t);
      }
      if (list.length >= 5) break;
    }
    return list;
  }, [sortedTracks, currentTrack]);

  // Center hero carousel if there are items
  useEffect(() => {
    if (carouselRef.current && heroTracks.length > 1) {
      const container = carouselRef.current;
      const cardWidth = container.offsetWidth * 0.75;
      container.scrollLeft = cardWidth * 0.5;
    }
  }, [heroTracks]);

  const handleHeroPlay = (track: MusicTrack) => {
    triggerHaptic("tap");
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track, sortedTracks, { type: "LIBRARY", title: "Spotlight" });
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

  const smartCollections = [
    {
      key: "liked",
      label: "Favorites",
      sub: counts.liked === 1 ? "1 favorite" : `${counts.liked} favorites`,
      icon: Heart,
      tint: "from-rose-500 to-red-600",
    },
    {
      key: "offline",
      label: "On Device",
      sub: counts.offline === 1 ? "1 offline" : `${counts.offline} offline`,
      icon: HardDriveDownload,
      tint: "from-emerald-500 to-teal-600",
    },
    {
      key: "recent",
      label: "Recently Played",
      sub: counts.recent === 1 ? "1 played" : `${counts.recent} played`,
      icon: Clock,
      tint: "from-sky-500 to-cyan-600",
    },
    {
      key: "top",
      label: "Heavy Rotation",
      sub: counts.top === 1 ? "1 top track" : `${counts.top} top tracks`,
      icon: Flame,
      tint: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="space-y-6 pb-28 animate-fade-in select-none">
      {/* 1. Brand Top Bar: 🪐 NEBULA + Profile Link */}
      <header className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2 text-white">
          <NebulaPlanetIcon className="w-6 h-6 text-[#f95721]" />
          <span className="font-extrabold text-lg tracking-[0.2em] uppercase text-white font-display">
            NEBULA
          </span>
        </div>

        <Link
          href="/secret"
          onClick={() => triggerHaptic("tap")}
          className="relative group p-0.5 rounded-full"
          aria-label="Private Atlas Hub"
        >
          <div className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-xs font-bold text-neutral-300 group-hover:text-white group-hover:border-[#f95721]/50 shadow-md transition-all">
            ATLAS
          </div>
        </Link>
      </header>

      {/* 2. Real Search Capsule Pill */}
      <div className="relative">
        <div className="h-14 rounded-full bg-[#121215]/90 border border-[#f95721]/30 backdrop-blur-xl px-5 flex items-center justify-between shadow-[0_0_24px_rgba(249,87,33,0.08)] transition-all focus-within:border-[#f95721] focus-within:shadow-[0_0_28px_rgba(249,87,33,0.2)]">
          <div className="flex-1 flex items-center gap-2 min-w-0 pr-3">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${greeting}! Search songs or artists…`}
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
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#f95721] shadow-[0_0_16px_rgba(249,87,33,0.45)] active:scale-90 transition-transform cursor-pointer shrink-0 flex items-center justify-center"
              aria-label="Search"
            >
              <Search className="w-4.5 h-4.5 text-white stroke-[2.4]" />
            </button>
          )}
        </div>

        {/* Real-time search results drop-down when searching */}
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

      {/* 4. Hero Carousel Section (Displays Actual Library Tracks or Empty State) */}
      {heroTracks.length > 0 ? (
        <section className="relative -mx-4 px-4 overflow-hidden">
          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {heroTracks.map((track, idx) => {
              const isCenterCard = idx === 0;
              const isTrackCurrentlyPlaying =
                currentTrack && currentTrack.id === track.id && isPlaying;

              return (
                <div
                  key={track.id}
                  className={`shrink-0 snap-center transition-all duration-300 ${
                    isCenterCard
                      ? "w-[78vw] max-w-[340px]"
                      : "w-[65vw] max-w-[270px] opacity-75 scale-95"
                  }`}
                >
                  <div
                    className="relative aspect-[4/5] rounded-[32px] overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl group cursor-pointer"
                    onClick={() => handleHeroPlay(track)}
                  >
                    {track.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.artworkUrl}
                        alt={track.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center text-white/20">
                        <Music className="w-16 h-16" />
                      </div>
                    )}

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
                          handleHeroPlay(track);
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
                        {track.title}
                      </h3>
                      <p className="text-sm font-medium text-neutral-300 truncate mt-1">
                        {track.artist || "Unknown Artist"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 px-1 text-center">
                    <p className="text-xs font-semibold text-neutral-400">
                      {track.album || (hasLocalAudio(track) ? "Offline Hi-Fi" : "Vault Audio")}
                    </p>
                    <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {formatTime(track.duration)} · {track.playCount || 0} plays
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-[32px] bg-[#121215] border border-white/[0.06] p-6 text-center">
          <EmptyState
            title="Your sonic vault awaits"
            body="Tap below to pull audio from YouTube, import songs from your phone, or restore your cloud library."
            cta="Add your first song"
            onCta={openAddSheet}
          />
        </section>
      )}

      {/* 5. Section: "Day-Starter Beats" */}
      <section className="space-y-4 pt-1">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-none">
              Day-Starter
            </h2>
            <h3 className="text-xl sm:text-2xl font-bold text-neutral-400 tracking-tight leading-tight">
              Beats
            </h3>
          </div>

          <button
            onClick={handlePlayAllDayStarter}
            className="h-11 px-5 rounded-full bg-gradient-to-r from-[#f95721] to-[#ff6b35] text-white font-bold text-sm shadow-[0_6px_22px_rgba(249,87,33,0.45)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Play All</span>
          </button>
        </div>

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
            <p className="text-sm font-semibold text-white">No tracks added yet</p>
            <p className="text-xs text-neutral-400 mt-1">
              Add music to your vault to activate Day-Starter Beats.
            </p>
          </div>
        )}
      </section>

      {/* 6. Smart Collections Bento Grid (Real Functional Collections) */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xl font-bold text-white tracking-tight">Collections</h3>
          <Link
            href="/secret/music/library"
            onClick={() => triggerHaptic("tap")}
            className="text-xs font-semibold text-[#f95721] hover:underline flex items-center gap-0.5"
          >
            Full Library <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {smartCollections.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => {
                  triggerHaptic("tap");
                  router.push(`/secret/music/library?filter=${c.key}`);
                }}
                className="group flex items-center gap-3.5 p-3.5 rounded-3xl bg-[#121215] border border-white/[0.06] hover:border-white/20 active:scale-[0.97] transition-all text-left cursor-pointer shadow-lg"
              >
                <span
                  className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${c.tint} flex items-center justify-center shrink-0 shadow-md ring-1 ring-inset ring-white/25`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white truncate">
                    {c.label}
                  </span>
                  <span className="block text-[11px] text-neutral-400 font-mono truncate mt-0.5">
                    {c.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Audiophile Interactive Widgets Section */}
      <MusicWidgetsSection />

      {/* Track Action Modal Sheet */}
      <TrackActionSheet
        track={sheetTrack}
        onClose={() => setSheetTrack(null)}
        onChanged={load}
      />
    </div>
  );
}
