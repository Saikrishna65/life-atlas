"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Disc, Play, Music } from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";

interface AlbumGroup {
  album: string;
  artist: string;
  artworkUrl?: string;
  tracks: MusicTrack[];
}

export default function AlbumsPage() {
  const { playTrack, currentTrack } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);

  useEffect(() => {
    getAllTracks().then(setTracks).catch(console.error);
  }, []);

  const albumGroups = useMemo(() => {
    const map = new Map<string, AlbumGroup>();

    for (const t of tracks) {
      const key = `${t.album.toLowerCase()}__${t.artist.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          album: t.album || "Unknown Album",
          artist: t.artist || "Unknown Artist",
          artworkUrl: t.artworkUrl,
          tracks: [],
        });
      }
      const group = map.get(key)!;
      group.tracks.push(t);
      if (!group.artworkUrl && t.artworkUrl) {
        group.artworkUrl = t.artworkUrl;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.album.localeCompare(b.album));
  }, [tracks]);

  const handlePlayAlbum = (group: AlbumGroup) => {
    if (group.tracks.length > 0) {
      playTrack(group.tracks[0], group.tracks, {
        type: "ALBUM",
        title: group.album,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={() => getAllTracks().then(setTracks)} />

      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-slate-900 font-normal tracking-tight">
          Albums ({albumGroups.length})
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Albums compiled from your local tracks and expedition recordings.
        </p>
      </div>

      {albumGroups.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card-subtle border border-dashed border-slate-300 text-slate-500 text-xs space-y-2">
          <Disc className="w-8 h-8 text-slate-400 mx-auto" />
          <p>No albums indexed yet. Import audio files to populate your catalogue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {albumGroups.map((group) => (
            <div
              key={`${group.album}-${group.artist}`}
              onClick={() => handlePlayAlbum(group)}
              className="p-3.5 rounded-3xl bg-white/90 hover:bg-white border border-slate-200/90 hover:border-amber-300 transition-all duration-300 group cursor-pointer space-y-3 active:scale-98 shadow-xs hover:shadow-md relative overflow-hidden"
            >
              {/* Album Art with Vinyl Rim Simulation */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-xs">
                {group.artworkUrl ? (
                  <Image
                    src={group.artworkUrl}
                    alt={group.album}
                    fill
                    sizes="(max-width: 640px) 160px, 200px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center shadow-inner">
                    <Disc className="w-8 h-8 text-amber-600" />
                  </div>
                )}

                {/* Holographic Gloss Sheen */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/30 pointer-events-none" />

                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate group-hover:text-amber-800 transition-colors">
                  {group.album}
                </h4>
                <p className="text-[11px] font-sans text-slate-500 truncate mt-0.5">{group.artist}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                    {group.tracks.length} track(s)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
