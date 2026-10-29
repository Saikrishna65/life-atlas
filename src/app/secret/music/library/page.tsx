"use client";

import React, { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Play, Shuffle, X, ChevronLeft } from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";
import {
  Artwork,
  TrackRow,
  TrackActionSheet,
  EmptyState,
  hasLocalAudio,
  hasCloudCopy,
  openAddSheet,
  useLibraryRefresh,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";

type View = "songs" | "albums" | "artists";
type Filter = "all" | "liked" | "offline" | "cloud" | "recent" | "top";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "liked", label: "Liked" },
  { key: "offline", label: "On phone" },
  { key: "cloud", label: "Cloud" },
  { key: "recent", label: "Recent" },
  { key: "top", label: "Top played" },
];

function LibraryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { playTrack } = useMusicPlayer();

  const view = (["songs", "albums", "artists"].includes(params.get("view") || "")
    ? params.get("view")
    : "songs") as View;
  const filter = (FILTERS.some((f) => f.key === params.get("filter")) ? params.get("filter") : "all") as Filter;

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<{ kind: "album" | "artist"; name: string } | null>(null);
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);

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

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(params.toString());
    p.set(key, value);
    if (key === "view") p.delete("filter");
    setGroup(null);
    router.replace(`/secret/music/library?${p.toString()}`);
  };

  const songs = useMemo(() => {
    let list = [...tracks];
    if (group) {
      list = list.filter((t) =>
        group.kind === "album" ? (t.album || "Unknown Album") === group.name : (t.artist || "Unknown Artist") === group.name
      );
    } else {
      if (filter === "liked") list = list.filter((t) => t.isFavorite);
      if (filter === "offline") list = list.filter(hasLocalAudio);
      if (filter === "cloud") list = list.filter(hasCloudCopy);
      if (filter === "recent") list = list.filter((t) => t.lastPlayedAt).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
      if (filter === "top") list = list.filter((t) => (t.playCount || 0) > 0).sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q));
    }
    if (group || filter === "all" || filter === "liked" || filter === "offline" || filter === "cloud") {
      list.sort((a, b) => b.addedAt - a.addedAt);
    }
    return list;
  }, [tracks, filter, query, group]);

  const grouped = useMemo(() => {
    const kind = view === "albums" ? "album" : "artist";
    const map = new Map<string, MusicTrack[]>();
    for (const t of tracks) {
      const key = (kind === "album" ? t.album : t.artist) || (kind === "album" ? "Unknown Album" : "Unknown Artist");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    const q = query.trim().toLowerCase();
    return [...map.entries()]
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, view, query]);

  const showSongList = view === "songs" || !!group;
  const title = group ? group.name : view === "songs" ? "Library" : view === "albums" ? "Albums" : "Artists";

  const playList = (shuffle: boolean) => {
    if (!songs.length) return;
    triggerHaptic("tap");
    const list = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
    playTrack(list[0], list, { type: "LIBRARY", title });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex items-center gap-2 px-1 pt-1">
        {group && (
          <button
            onClick={() => setGroup(null)}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center active:bg-white/10 cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="font-display text-[34px] leading-none truncate">{title}</h1>
      </header>

      {/* Segmented control */}
      {!group && (
        <div className="grid grid-cols-3 p-1 rounded-2xl bg-white/[0.07] border border-white/10">
          {(["songs", "albums", "artists"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setParam("view", v)}
              className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition-all cursor-pointer ${
                view === v ? "bg-white text-black shadow" : "text-white/55"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-white/35 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${showSongList ? "songs" : view}`}
          className="w-full h-12 pl-11 pr-11 rounded-2xl bg-white/[0.07] border border-white/10 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/60"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-white/40 cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter chips (songs only) */}
      {view === "songs" && !group && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setParam("filter", f.key)}
              className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold border transition-colors cursor-pointer ${
                filter === f.key
                  ? "bg-fuchsia-500 border-fuchsia-400 text-white"
                  : "bg-white/[0.06] border-white/10 text-white/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loaded && tracks.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Add your first songs to build your library." cta="Add music" onCta={openAddSheet} />
      ) : showSongList ? (
        <>
          {songs.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => playList(false)}
                className="h-12 rounded-2xl bg-white text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Play {songs.length}
              </button>
              <button
                onClick={() => playList(true)}
                className="h-12 rounded-2xl bg-white/10 border border-white/10 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Shuffle className="w-4 h-4" /> Shuffle
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {songs.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i}
                onPlay={() => playTrack(t, songs, { type: "LIBRARY", title })}
                onMore={() => setSheetTrack(t)}
              />
            ))}
            {songs.length === 0 && <p className="text-center text-sm text-white/40 py-12">No songs match.</p>}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {grouped.map(([name, list]) => (
            <button
              key={name}
              onClick={() => {
                triggerHaptic("tap");
                setQuery("");
                setGroup({ kind: view === "albums" ? "album" : "artist", name });
              }}
              className="text-left active:scale-95 transition-transform cursor-pointer"
            >
              <Artwork
                track={list[0]}
                className={`w-full aspect-square shadow-xl ${view === "artists" ? "rounded-full" : "rounded-3xl"}`}
                iconClass="w-1/4 h-1/4"
              />
              <p className={`text-sm font-semibold truncate mt-2.5 ${view === "artists" ? "text-center" : ""}`}>{name}</p>
              <p className={`text-xs text-white/45 ${view === "artists" ? "text-center" : ""}`}>
                {list.length} song{list.length === 1 ? "" : "s"}
              </p>
            </button>
          ))}
          {grouped.length === 0 && <p className="col-span-2 text-center text-sm text-white/40 py-12">Nothing found.</p>}
        </div>
      )}

      <TrackActionSheet track={sheetTrack} onClose={() => setSheetTrack(null)} onChanged={load} />
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-white/40 text-sm">Loading…</div>}>
      <LibraryContent />
    </Suspense>
  );
}
