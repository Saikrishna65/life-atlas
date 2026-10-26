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
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumGroup | null>(null);

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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28">
      <MusicNav onTrackImported={() => getAllTracks().then(setTracks)} />

      <div>
        <h2 className="font-display text-2xl text-foreground font-normal">
          Albums ({albumGroups.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Albums compiled from your local tracks and expedition recordings.
        </p>
      </div>

      {albumGroups.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground text-xs space-y-2">
          <Disc className="w-8 h-8 text-muted-foreground/60 mx-auto" />
          <p>No albums indexed yet. Import audio files to populate your catalogue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {albumGroups.map((group) => (
            <div
              key={`${group.album}-${group.artist}`}
              onClick={() => handlePlayAlbum(group)}
              className="p-3.5 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 transition-all group cursor-pointer space-y-3"
            >
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shadow-md">
                {group.artworkUrl ? (
                  <Image
                    src={group.artworkUrl}
                    alt={group.album}
                    fill
                    sizes="(max-width: 640px) 160px, 200px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                ) : (
                  <Disc className="w-10 h-10 text-amber-500/70" />
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-amber-400 transition-colors">
                  {group.album}
                </h4>
                <p className="text-[11px] text-muted-foreground truncate">{group.artist}</p>
                <span className="text-[10px] font-mono text-muted-foreground/70">
                  {group.tracks.length} track(s)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
