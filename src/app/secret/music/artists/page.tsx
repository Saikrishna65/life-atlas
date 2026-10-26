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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={() => getAllTracks().then(setTracks)} />

      <div>
        <h2 className="font-display text-2xl sm:text-3xl text-white font-normal tracking-tight">
          Artists & Composers ({artistGroups.length})
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Musicians and ambient field recordists represented in your Vault.
        </p>
      </div>

      {artistGroups.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card-subtle border border-dashed border-white/10 text-neutral-400 text-xs space-y-2">
          <Users className="w-8 h-8 text-neutral-500 mx-auto" />
          <p>No artists found in your library yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {artistGroups.map((group) => (
            <div
              key={group.artist}
              onClick={() => handlePlayArtist(group)}
              className="p-4 rounded-3xl glass-card-subtle hover:bg-white/[0.08] border border-white/10 hover:border-amber-500/40 transition-all duration-300 flex items-center justify-between gap-4 group cursor-pointer active:scale-98 shadow-lg"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-[#10131d] border-2 border-white/15 group-hover:border-amber-400 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] shrink-0 flex items-center justify-center shadow-md transition-all">
                  {group.artworkUrl ? (
                    <Image
                      src={group.artworkUrl}
                      alt={group.artist}
                      fill
                      sizes="56px"
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                      unoptimized
                    />
                  ) : (
                    <Users className="w-5 h-5 text-amber-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                    {group.artist}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 font-semibold">
                      {group.tracks.length} track(s)
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400">
                      {group.albums.length} album(s)
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-gradient-to-r group-hover:from-amber-400 group-hover:to-amber-500 group-hover:text-neutral-950 flex items-center justify-center text-neutral-300 transition-all shrink-0 shadow-sm group-hover:neon-glow-amber">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
