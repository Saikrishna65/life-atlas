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
  Disc3,
  SlidersHorizontal,
  Flame,
  Clock,
  Heart,
  HardDriveDownload,
  Music,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import {
  Artwork,
  Equalizer,
  TrackRow,
  TrackActionSheet,
  EmptyState,
  formatTime,
  openAddSheet,
  useLibraryRefresh,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";
import CategoryTabs from "@/components/music/CategoryTabs";
import MusicWidgetsSection from "@/components/music/MusicWidgetsSection";

// Reference spotlight cards matching the exact visual assets in Image 2
interface HeroSlide {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  contextNote: string;
  tracksCountText?: string;
  colorTheme?: string;
  isDemo?: boolean;
}

const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "hero_the_weeknd",
    title: "Starboy",
    artist: "The Weeknd",
    artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=700&auto=format&fit=crop&q=80",
    contextNote: "Late night drives & pulse rhythms",
    tracksCountText: "28 Tracks",
    isDemo: true,
  },
  {
    id: "hero_billie",
    title: "Birds of a feather",
    artist: "Billie Eilish",
    artworkUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    contextNote: "Based on your 8AM gym session",
    isDemo: true,
  },
  {
    id: "hero_rema",
    title: "Calm Down",
    artist: "Rema",
    artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=700&auto=format&fit=crop&q=80",
    contextNote: "Golden hour energy & sunlit beats",
    tracksCountText: "16 Tracks",
    isDemo: true,
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
  const { playTrack, currentTrack, isPlaying, togglePlayPause, setIsNowPlayingOpen } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [greeting] = useState(getGreeting);
  const carouselRef = useRef<HTMLDivElement>(null);

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

  // Combine user tracks with hero slides for the rich interactive carousel
  const heroSlides = useMemo<HeroSlide[]>(() => {
    if (sortedTracks.length === 0) {
      return DEFAULT_HERO_SLIDES;
    }

    const slides: HeroSlide[] = [];

    // Active playing or latest track as featured center
    const primary = currentTrack || sortedTracks[0];
    slides.push({
      id: primary.id,
      title: primary.title,
      artist: primary.artist || "Unknown Artist",
      artworkUrl: primary.artworkUrl || DEFAULT_HERO_SLIDES[1].artworkUrl,
      contextNote: "Based on your 8AM gym session",
      isDemo: false,
    });

    // Add 2nd track
    if (sortedTracks[1]) {
      slides.unshift({
        id: sortedTracks[1].id,
        title: sortedTracks[1].title,
        artist: sortedTracks[1].artist || "Unknown Artist",
        artworkUrl: sortedTracks[1].artworkUrl || DEFAULT_HERO_SLIDES[0].artworkUrl,
        contextNote: "Recent high-energy spin",
        tracksCountText: `${sortedTracks.length} Tracks`,
        isDemo: false,
      });
    } else {
      slides.unshift(DEFAULT_HERO_SLIDES[0]);
    }

    // Add 3rd track
    if (sortedTracks[2]) {
      slides.push({
        id: sortedTracks[2].id,
        title: sortedTracks[2].title,
        artist: sortedTracks[2].artist || "Unknown Artist",
        artworkUrl: sortedTracks[2].artworkUrl || DEFAULT_HERO_SLIDES[2].artworkUrl,
        contextNote: "Sunset acoustic session",
        tracksCountText: "14 Tracks",
        isDemo: false,
      });
    } else {
      slides.push(DEFAULT_HERO_SLIDES[2]);
    }

    return slides;
  }, [sortedTracks, currentTrack]);

  // Center the hero carousel on mount
  useEffect(() => {
    if (carouselRef.current) {
      const container = carouselRef.current;
      const cardWidth = container.offsetWidth * 0.75;
      container.scrollLeft = cardWidth * 0.8;
    }
  }, [heroSlides]);

  const handleHeroPlay = (slide: HeroSlide) => {
    triggerHaptic("tap");
    const matchingTrack = tracks.find((t) => t.id === slide.id);
    if (matchingTrack) {
      if (currentTrack?.id === matchingTrack.id) {
        togglePlayPause();
      } else {
        playTrack(matchingTrack, sortedTracks, { type: "LIBRARY", title: "Spotlight" });
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
      playTrack(sortedTracks[0], sortedTracks, { type: "LIBRARY", title: "Day-Starter Beats" });
    } else {
      openAddSheet();
    }
  };

  return (
    <div className="space-y-6 pb-28 animate-fade-in select-none">
      {/* 1. Brand Top Bar: 🪐 NEBULA + Profile Avatar */}
      <header className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2 text-white">
          <NebulaPlanetIcon className="w-6 h-6 text-white" />
          <span className="font-extrabold text-lg tracking-[0.2em] uppercase text-white font-display">
            NEBULA
          </span>
        </div>

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
      </header>

      {/* 2. Search / Voice Capsule Pill */}
      <div className="relative">
        <div className="h-14 rounded-full bg-[#121215]/90 border border-[#f95721]/30 backdrop-blur-xl px-5 flex items-center justify-between shadow-[0_0_24px_rgba(249,87,33,0.08)] transition-all focus-within:border-[#f95721] focus-within:shadow-[0_0_28px_rgba(249,87,33,0.18)]">
          <div className="flex-1 flex items-center gap-2 min-w-0 pr-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchActive(true)}
              placeholder={`${greeting}, Anu!, What's your pick?`}
              className="w-full bg-transparent text-sm font-medium text-white placeholder:text-neutral-500 focus:outline-none"
            />
          </div>

          {/* Glowing Radial Gradient Mic Button */}
          <button
            onClick={() => {
              triggerHaptic("tap");
              if (!isSearchActive) {
                setIsSearchActive(true);
              } else {
                openAddSheet();
              }
            }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-white via-[#ff7a45] to-[#f95721] p-[2px] shadow-[0_0_16px_rgba(249,87,33,0.45)] active:scale-90 transition-transform cursor-pointer shrink-0 flex items-center justify-center"
            aria-label="Voice Search"
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#ff6b35] to-[#f95721] flex items-center justify-center">
              <Mic className="w-4.5 h-4.5 text-white stroke-[2.2]" />
            </div>
          </button>
        </div>
      </div>

      {/* 3. Category Navigation Tabs */}
      <CategoryTabs />

      {/* 4. Hero Carousel Section */}
      <section className="relative -mx-4 px-4 overflow-hidden">
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {heroSlides.map((slide, idx) => {
            const isCenterCard = idx === 1;
            const isTrackCurrentlyPlaying =
              currentTrack && currentTrack.id === slide.id && isPlaying;

            return (
              <div
                key={slide.id}
                className={`shrink-0 snap-center transition-all duration-300 ${
                  isCenterCard
                    ? "w-[78vw] max-w-[340px]"
                    : "w-[65vw] max-w-[270px] opacity-75 scale-95"
                }`}
              >
                {/* Hero Card Container */}
                <div
                  className="relative aspect-[4/5] rounded-[32px] overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl group cursor-pointer"
                  onClick={() => handleHeroPlay(slide)}
                >
                  {/* Artwork Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.artworkUrl}
                    alt={slide.title}
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
                        handleHeroPlay(slide);
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
                      {slide.title}
                    </h3>
                    <p className="text-sm font-medium text-neutral-300 truncate mt-1">
                      {slide.artist}
                    </p>
                  </div>
                </div>

                {/* Subtitle / Context Note Underneath the Card */}
                <div className="mt-3 px-1 text-center">
                  <p className="text-xs font-semibold text-neutral-400">
                    {slide.contextNote}
                  </p>
                  {slide.tracksCountText && (
                    <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {slide.tracksCountText}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Section: "Day-Starter Beats" */}
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

      {/* 6. Section: "Podcast Picks" Card */}
      <section className="pt-1">
        <div className="rounded-[28px] bg-[#121215] border border-white/[0.06] p-4.5 flex items-center justify-between shadow-xl">
          <div>
            <h4 className="text-lg font-bold text-white tracking-tight">Podcast Picks</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              {sortedTracks.length > 0 ? `${sortedTracks.length} Tracks` : "28 Tracks"}
            </p>
          </div>

          <Link
            href="/secret/music/library?filter=podcast"
            onClick={() => triggerHaptic("tap")}
            className="px-4.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white transition-all active:scale-95 cursor-pointer"
          >
            View All
          </Link>
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
