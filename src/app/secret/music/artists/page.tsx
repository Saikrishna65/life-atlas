"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Users, Play, Music } from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { getAllTracks } from "@/lib/music/storage";
import { MusicTrack } from "@/lib/music/types";

interface ArtistGroup {
  artist: string;
  tracks: MusicTrack[];
  albums: string[];
  artworkUrl?: string;
}

export default function ArtistsPage() {
  const { playTrack } = useMusicPlayer();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);

  useEffect(() => {
    getAllTracks().then(setTracks).catch(console.error);
  }, []);

  const artistGroups = useMemo(() => {
    const map = new Map<string, ArtistGroup>();

    for (const t of tracks) {
      const name = t.artist || "Unknown Artist";
      if (!map.has(name)) {
        map.set(name, {
          artist: name,
          tracks: [],
          albums: [],
          artworkUrl: t.artworkUrl,
        });
      }
      const group = map.get(name)!;
      group.tracks.push(t);
      if (t.album && !group.albums.includes(t.album)) {
        group.albums.push(t.album);
      }
      if (!group.artworkUrl && t.artworkUrl) {
        group.artworkUrl = t.artworkUrl;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.artist.localeCompare(b.artist));
  }, [tracks]);

  const handlePlayArtist = (group: ArtistGroup) => {
    if (group.tracks.length > 0) {
      playTrack(group.tracks[0], group.tracks, {
        type: "ARTIST",
        title: group.artist,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28">
      <MusicNav onTrackImported={() => getAllTracks().then(setTracks)} />

      <div>
        <h2 className="font-display text-2xl text-foreground font-normal">
          Artists ({artistGroups.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Musicians and ambient field recordists represented in your Vault.
        </p>
      </div>

      {artistGroups.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground text-xs space-y-2">
          <Users className="w-8 h-8 text-muted-foreground/60 mx-auto" />
          <p>No artists found in your library yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {artistGroups.map((group) => (
            <div
              key={group.artist}
              onClick={() => handlePlayArtist(group)}
              className="p-4 rounded-2xl bg-surface hover:bg-surface-hover/80 border border-white/5 transition-all flex items-center justify-between gap-4 group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                  {group.artworkUrl ? (
                    <Image
                      src={group.artworkUrl}
                      alt={group.artist}
                      fill
                      sizes="48px"
                      className="object-cover group-hover:scale-105 transition-transform"
                      unoptimized
                    />
                  ) : (
                    <Users className="w-5 h-5 text-amber-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-medium text-foreground group-hover:text-amber-400 transition-colors truncate">
                    {group.artist}
                  </h4>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {group.tracks.length} track(s) • {group.albums.length} album(s)
                  </p>
                </div>
              </div>

              <div className="w-9 h-9 rounded-full bg-white/5 group-hover:bg-amber-500 group-hover:text-black flex items-center justify-center text-muted-foreground transition-colors shrink-0">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
