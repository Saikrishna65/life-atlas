"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Shuffle,
  Heart,
  HardDriveDownload,
  Clock,
  Flame,
  ChevronRight,
  ArrowLeft,
  Disc3,
  Palette,
} from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import {
  Artwork,
  Equalizer,
  SpectrumBars,
  TrackRow,
  TrackActionSheet,
  EmptyState,
  SectionTitle,
  formatTime,
  gradientFor,
  hasLocalAudio,
  openAddSheet,
  useLibraryRefresh,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";
import { MUSIC_THEMES, useMusicTheme } from "@/lib/music/theme";

function getSonicSessionLabel(): { eyebrow: string; accent: string } {
  const hr = new Date().getHours();
  if (hr < 5) return { eyebrow: "Late Night Session", accent: "nocturne" };
  if (hr < 12) return { eyebrow: "Morning Frequencies", accent: "soundtrack" };
  if (hr < 17) return { eyebrow: "Afternoon Resonance", accent: "wavelength" };
  if (hr < 22) return { eyebrow: "Evening Lounge", accent: "atmosphere" };
  return { eyebrow: "Midnight Sanctuary", accent: "nocturne" };
}

export default function MusicHomePage() {
  const router = useRouter();
  const { playTrack, currentTrack, isPlaying, togglePlayPause, setIsNowPlayingOpen } = useMusicPlayer();
  const { theme, setTheme, currentOption } = useMusicTheme();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);
  const [session] = useState(getSonicSessionLabel);

  const load = useCallback(async () => {
    try {
      setTracks(await getAllTracks());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useLibraryRefresh(load);

  const cyclePalette = () => {
    triggerHaptic("tap");
    const idx = MUSIC_THEMES.findIndex((t) => t.id === theme);
    const next = MUSIC_THEMES[(idx + 1) % MUSIC_THEMES.length];
    setTheme(next.id);
  };

  const sorted = useMemo(() => [...tracks].sort((a, b) => b.addedAt - a.addedAt), [tracks]);
  const counts = useMemo(
    () => ({
      liked: tracks.filter((t) => t.isFavorite).length,
      offline: tracks.filter(hasLocalAudio).length,
      recent: tracks.filter((t) => t.lastPlayedAt).length,
      top: tracks.filter((t) => (t.playCount || 0) > 0).length,
    }),
    [tracks]
  );
  const totalMinutes = Math.max(1, Math.round(tracks.reduce((s, t) => s + (t.duration || 0), 0) / 60));

  const featured = currentTrack || sorted[0] || null;
  const featuredActive = Boolean(currentTrack && featured && currentTrack.id === featured.id);

  // Exclude the hero spotlight track from the horizontal carousel so small libraries never show duplicate cards
  const carouselTracks = useMemo(
    () => sorted.filter((t) => t.id !== featured?.id).slice(0, 10),
    [sorted, featured]
  );

  const playAll = (shuffle: boolean) => {
    if (!sorted.length) return;
    triggerHaptic("tap");
    const list = shuffle ? [...sorted].sort(() => Math.random() - 0.5) : sorted;
    playTrack(list[0], list, { type: "LIBRARY", title: shuffle ? "Shuffle all" : "All songs" });
  };

  const collections = [
    {
      key: "liked",
      label: "Liked",
      sub: counts.liked === 1 ? "1 favorite" : `${counts.liked} favorites`,
      icon: Heart,
      tint: "from-rose-500 to-red-600",
    },
    {
      key: "offline",
      label: "On phone",
      sub: counts.offline === 1 ? "1 offline" : `${counts.offline} offline`,
      icon: HardDriveDownload,
      tint: "from-emerald-500 to-teal-600",
    },
    {
      key: "recent",
      label: "Recent",
      sub: counts.recent === 1 ? "1 played" : `${counts.recent} played`,
      icon: Clock,
      tint: "from-sky-500 to-cyan-600",
    },
    {
      key: "top",
      label: "Heavy rotation",
      sub: counts.top === 1 ? "1 top track" : `${counts.top} top tracks`,
      icon: Flame,
      tint: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Top utility row: effortless return to Private Atlas + 1-tap theme pill + live playback status */}
      <div className="flex items-center justify-between pt-0.5 gap-2">
        <Link
          href="/secret"
          onClick={() => triggerHaptic("tap")}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full sonic-glass text-xs font-semibold text-[var(--mv-text-muted)] active:scale-95 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Atlas
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cyclePalette}
            title={`Theme: ${currentOption.name} (tap to switch)`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full sonic-glass text-[11px] font-semibold text-[var(--mv-text-muted)] active:scale-95 transition-all cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-[var(--mv-accent)]" />
            <span className="hidden sm:inline">{currentOption.name}</span>
            <span
              className="w-2.5 h-2.5 rounded-full ring-1 ring-black/15"
              style={{ background: currentOption.swatches[2] }}
            />
          </button>

          <button
            onClick={() => {
              if (currentTrack) {
                triggerHaptic("tap");
                setIsNowPlayingOpen(true);
              }
            }}
            style={
              currentTrack && isPlaying
                ? {
                    background: "var(--mv-accent-soft)",
                    borderColor: "var(--mv-border-strong)",
                    color: "var(--mv-accent)",
                  }
                : undefined
            }
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full border text-[11px] font-mono uppercase tracking-[0.18em] transition-all ${
              currentTrack && isPlaying
                ? "cursor-pointer"
                : "sonic-glass text-[var(--mv-text-subtle)] cursor-default"
            }`}
          >
            {currentTrack && isPlaying ? (
              <>
                <Equalizer />
                <span>Live</span>
              </>
            ) : (
              <>
                <Disc3 className="w-3.5 h-3.5 text-[var(--mv-accent)]" />
                <span>Sonic</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editorial Hero Title */}
      <header className="px-0.5">
        <p className="text-[11px] tracking-[0.26em] uppercase text-[var(--mv-accent)] font-semibold">
          {session.eyebrow}
        </p>
        <h1 className="font-display text-[38px] sm:text-[44px] text-[var(--mv-text)] leading-[1.05] mt-1.5">
          Your{" "}
          <span
            style={{
              backgroundImage: "linear-gradient(135deg, var(--mv-accent), var(--mv-accent-2))",
            }}
            className="bg-clip-text text-transparent"
          >
            {session.accent}
          </span>
        </h1>
        {tracks.length > 0 && (
          <p className="text-xs text-[var(--mv-text-muted)] mt-2 font-mono tracking-wide">
            {tracks.length} {tracks.length === 1 ? "SONG" : "SONGS"} · {totalMinutes} MIN ·{" "}
            {counts.offline} OFFLINE
          </p>
        )}
      </header>

      {loaded && tracks.length === 0 ? (
        <div className="sonic-glass rounded-[32px] p-2">
          <EmptyState
            title="Your sonic vault awaits"
            body="Tap the + button below to pull audio from YouTube, import songs from your phone, or restore your cloud library."
            cta="Add your first song"
            onCta={openAddSheet}
          />
        </div>
      ) : (
        <>
          {/* Sonic Stage Hero Card */}
          {featured && (
            <section
              onClick={() => {
                if (currentTrack) {
                  triggerHaptic("tap");
                  setIsNowPlayingOpen(true);
                }
              }}
              className={`relative overflow-hidden rounded-[32px] sonic-glass p-5 sm:p-6 transition-transform ${
                currentTrack ? "cursor-pointer active:scale-[0.99]" : ""
              }`}
            >
              {featured.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.artworkUrl}
                  alt=""
                  className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-125"
                />
              )}
              <div
                style={{
                  background: "linear-gradient(135deg, var(--mv-accent-soft) 0%, transparent 70%)",
                }}
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
              />

              <div className="relative flex items-center gap-4">
                {/* Album cover with peeking spinning vinyl record */}
                <div className="relative w-28 h-24 shrink-0 flex items-center">
                  <div
                    className={`absolute right-0 w-22 h-22 rounded-full vinyl-grooves border border-white/15 shadow-2xl flex items-center justify-center ${
                      featuredActive && isPlaying ? "animate-vinyl" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <div
                      style={{ background: "var(--mv-accent)" }}
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradientFor(
                        featured.id
                      )} border-2 border-[#090910]`}
                    />
                  </div>
                  <Artwork
                    track={featured}
                    className="relative z-10 w-24 h-24 rounded-[22px] shadow-[0_16px_35px_rgba(0,0,0,0.45)]"
                    iconClass="w-8 h-8"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        background: "var(--mv-accent-soft)",
                        borderColor: "var(--mv-border-strong)",
                        color: "var(--mv-accent)",
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] tracking-[0.18em] uppercase font-semibold"
                    >
                      {featuredActive
                        ? isPlaying
                          ? "Now playing"
                          : "Paused"
                        : "Spotlight"}
                    </span>
                    {hasLocalAudio(featured) && (
                      <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider font-semibold">
                        Hi-Fi
                      </span>
                    )}
                  </div>

                  <h2 className="font-display text-2xl text-[var(--mv-text)] leading-tight truncate mt-2">
                    {featured.title}
                  </h2>
                  <p className="text-sm text-[var(--mv-text-muted)] truncate">
                    {featured.artist || "Unknown Artist"}
                  </p>

                  <div className="flex items-center gap-3 mt-2">
                    <SpectrumBars playing={Boolean(featuredActive && isPlaying)} />
                    <span className="text-[11px] font-mono text-[var(--mv-text-subtle)]">
                      {formatTime(featured.duration)}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="relative grid grid-cols-2 gap-3 mt-5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    triggerHaptic("tap");
                    if (featuredActive) togglePlayPause();
                    else playTrack(featured, sorted, { type: "LIBRARY", title: "All songs" });
                  }}
                  style={{
                    background: "var(--mv-primary-bg)",
                    color: "var(--mv-primary-fg)",
                  }}
                  className="h-13 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform cursor-pointer"
                >
                  {featuredActive && isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Play
                    </>
                  )}
                </button>
                <button
                  onClick={() => playAll(true)}
                  className="h-13 rounded-2xl sonic-glass text-[var(--mv-text)] font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
                >
                  <Shuffle className="w-4 h-4 text-[var(--mv-accent)]" />
                  Shuffle
                </button>
              </div>
            </section>
          )}

          {/* 4 Bento Smart Collections */}
          <section>
            <SectionTitle title="Collections" />
            <div className="grid grid-cols-2 gap-3">
              {collections.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    onClick={() => {
                      triggerHaptic("tap");
                      router.push(`/secret/music/library?filter=${c.key}`);
                    }}
                    className="group flex items-center gap-3.5 p-3.5 rounded-3xl sonic-glass hover:border-[var(--mv-border-strong)] active:scale-[0.97] transition-all text-left cursor-pointer"
                  >
                    <span
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${c.tint} flex items-center justify-center shrink-0 shadow-md ring-1 ring-inset ring-white/25`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--mv-text)] truncate">
                        {c.label}
                      </span>
                      <span className="block text-[11px] text-[var(--mv-text-muted)] font-mono truncate mt-0.5">
                        {c.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Horizontal cover carousel — only rendered when there are >=3 additional songs beyond the Hero Spotlight */}
          {carouselTracks.length >= 3 && (
            <section>
              <SectionTitle
                title="Fresh drops"
                action="See all"
                onAction={() => router.push("/secret/music/library")}
              />
              <div className="flex gap-3.5 overflow-x-auto -mx-4 px-4 pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {carouselTracks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      triggerHaptic("tap");
                      playTrack(t, sorted, { type: "LIBRARY", title: "All songs" });
                    }}
                    className="w-36 shrink-0 snap-start text-left active:scale-95 transition-transform cursor-pointer"
                  >
                    <Artwork
                      track={t}
                      className="w-36 h-36 rounded-3xl shadow-xl"
                      iconClass="w-8 h-8"
                    />
                    <p className="text-sm font-semibold text-[var(--mv-text)] truncate mt-2.5">
                      {t.title}
                    </p>
                    <p className="text-xs text-[var(--mv-text-muted)] truncate">{t.artist}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Compact Track List */}
          <section>
            <SectionTitle
              title="Tracks"
              action={`All ${tracks.length}`}
              onAction={() => router.push("/secret/music/library")}
            />
            <div className="rounded-3xl sonic-glass p-1.5 space-y-0.5">
              {sorted.slice(0, 6).map((t, idx) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={idx}
                  onPlay={() => playTrack(t, sorted, { type: "LIBRARY", title: "All songs" })}
                  onMore={() => setSheetTrack(t)}
                />
              ))}
            </div>
            {tracks.length > 6 && (
              <button
                onClick={() => router.push("/secret/music/library")}
                className="w-full mt-3 py-3.5 rounded-2xl sonic-glass text-sm font-semibold text-[var(--mv-text)] flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                Explore full library <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </section>
        </>
      )}

      <TrackActionSheet track={sheetTrack} onClose={() => setSheetTrack(null)} onChanged={load} />
    </div>
  );
}
