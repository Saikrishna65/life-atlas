"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Play,
  Shuffle,
  ChevronUp,
  ChevronDown,
  Trash2,
  Compass,
  Download,
  ListMusic,
  Plus,
  Music,
  Check,
  Disc,
} from "lucide-react";
import MusicNav from "@/components/music/MusicNav";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getPlaylist,
  savePlaylist,
  getAllTracks,
  reorderPlaylistTracks,
  removeTrackFromPlaylist,
  exportPlaylistM3U,
  linkPlaylistToTrip,
  unlinkPlaylistFromTrip,
} from "@/lib/music/storage";
import { getAllTrips } from "@/lib/vault/storage";
import { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import { TripRecord } from "@/lib/vault/types";

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = typeof params?.playlistId === "string" ? params.playlistId : "";

  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const [playlist, setPlaylist] = useState<MusicPlaylist | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [showTripModal, setShowTripModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      if (!playlistId) return;
      const pl = await getPlaylist(playlistId);
      if (!pl) {
        router.push("/secret/music/playlists");
        return;
      }
      setPlaylist(pl);

      const allTracks = await getAllTracks();
      const trackMap = new Map(allTracks.map((t) => [t.id, t]));
      const orderedTracks = pl.trackIds
        .map((id) => trackMap.get(id))
        .filter((t): t is MusicTrack => !!t);

      setTracks(orderedTracks);

      try {
        const tripList = await getAllTrips();
        setTrips(tripList);
      } catch {
        // Trip Vault optional
      }
    } catch (err) {
      console.error("Failed loading playlist:", err);
    } finally {
      setIsLoading(false);
    }
  }, [playlistId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePlayAll = (shuffle = false) => {
    if (tracks.length === 0 || !playlist) return;
    const queueTracks = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
    playTrack(queueTracks[0], queueTracks, {
      type: "PLAYLIST",
      id: playlist.id,
      title: playlist.title,
    });
  };

  const handleMoveTrack = async (index: number, direction: "UP" | "DOWN") => {
    if (!playlist) return;
    const newIndex = direction === "UP" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= playlist.trackIds.length) return;

    const copy = [...playlist.trackIds];
    const [moved] = copy.splice(index, 1);
    copy.splice(newIndex, 0, moved);

    await reorderPlaylistTracks(playlist.id, copy);
    await loadData();
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!playlist) return;
    await removeTrackFromPlaylist(playlist.id, trackId);
    await loadData();
  };

  const handleExportM3U = () => {
    if (!playlist) return;
    const m3u = exportPlaylistM3U(playlist, tracks);
    const blob = new Blob([m3u], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${playlist.title.replace(/\s+/g, "_")}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLinkTrip = async (tripId: string) => {
    if (!playlist) return;
    await linkPlaylistToTrip(playlist.id, tripId);
    setShowTripModal(false);
    await loadData();
  };

  const handleUnlinkTrip = async () => {
    if (!playlist) return;
    await unlinkPlaylistFromTrip(playlist.id);
    await loadData();
  };

  if (isLoading || !playlist) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-neutral-400 text-xs animate-fade-in">
        Loading soundtrack...
      </div>
    );
  }

  const linkedTrip = trips.find((t) => t.id === playlist.tripId);
  const totalDurationSecs = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMins = Math.floor(totalDurationSecs / 60);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-28 select-none">
      <MusicNav onTrackImported={loadData} />

      {/* Playlist Hero Header */}
      <div className="p-6 sm:p-8 rounded-3xl glass-card-premium border border-white/12 flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <ListMusic className="w-12 h-12" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 inline-block shadow-xs">
            Soundtrack Collection
          </span>

          <h2 className="font-display text-2xl sm:text-3xl text-white font-normal tracking-tight">
            {playlist.title}
          </h2>

          <p className="text-xs text-neutral-300 max-w-lg leading-relaxed">
            {playlist.description || "Custom expedition soundtrack playlist."}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 font-sans pt-1">
            <span className="font-mono text-neutral-300">{tracks.length} track(s)</span>
            <span>•</span>
            <span className="font-mono text-neutral-300">{totalMins} min listening</span>
            {linkedTrip && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5 text-amber-300 font-medium bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/25">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Expedition: {linkedTrip.title}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Play Controls & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePlayAll(false)}
            disabled={tracks.length === 0}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-neutral-950 font-sans text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_25px_rgba(245,158,11,0.35)] active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
            <span>Play All</span>
          </button>

          <button
            onClick={() => handlePlayAll(true)}
            disabled={tracks.length === 0}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl glass-card-subtle hover:bg-white/[0.08] text-neutral-200 text-xs font-sans font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 border border-white/10"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
            <span>Shuffle</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTripModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl glass-card-subtle hover:bg-white/[0.08] text-xs font-sans text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95 border border-white/10 shadow-sm"
            title="Attach to an expedition in Trip Vault"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>{linkedTrip ? "Change Expedition" : "Link to Trip"}</span>
          </button>

          <button
            onClick={handleExportM3U}
            disabled={tracks.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl glass-card-subtle hover:bg-white/[0.08] text-xs font-sans text-neutral-200 hover:text-white transition-all disabled:opacity-40 cursor-pointer active:scale-95 border border-white/10 shadow-sm"
            title="Export M3U playlist file"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export M3U</span>
          </button>
        </div>
      </div>

      {/* Track List with Reordering */}
      {tracks.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-card-subtle border border-dashed border-white/10 text-neutral-400 text-xs space-y-3">
          <p className="text-neutral-300 font-medium">This playlist has no tracks yet.</p>
          <Link
            href="/secret/music/library"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Browse Library to Add Tracks</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map((t, idx) => {
            const isCurrent = currentTrack?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() =>
                  playTrack(t, tracks, {
                    type: "PLAYLIST",
                    id: playlist.id,
                    title: playlist.title,
                  })
                }
                className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3.5 cursor-pointer group active:scale-[0.99] ${
                  isCurrent
                    ? "bg-amber-500/15 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                    : "glass-card-subtle hover:bg-white/[0.08] border-white/[0.08]"
                }`}
              >
                {/* Index / Reorder Steppers */}
                <div
                  className="flex flex-col items-center justify-center shrink-0 w-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveTrack(idx, "UP")}
                    className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer active:scale-90 transition-transform"
                    aria-label="Move track up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-neutral-400">{idx + 1}</span>
                  <button
                    disabled={idx === tracks.length - 1}
                    onClick={() => handleMoveTrack(idx, "DOWN")}
                    className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer active:scale-90 transition-transform"
                    aria-label="Move track down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Artwork + Title */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-[#121622] border border-white/10 shrink-0 flex items-center justify-center shadow-md">
                    {t.artworkUrl ? (
                      <Image
                        src={t.artworkUrl}
                        alt={t.title}
                        fill
                        sizes="44px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Disc className="w-4 h-4 text-amber-400" />
                    )}

                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                        {isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3" aria-label="Playing">
                            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-3" />
                          </div>
                        ) : (
                          <Play className="w-4 h-4 fill-amber-400 text-amber-400 ml-0.5" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                        isCurrent ? "text-amber-300" : "text-white group-hover:text-amber-200"
                      }`}
                    >
                      {t.title}
                    </h4>
                    <p className="text-[11px] font-sans text-neutral-400 truncate mt-0.5">{t.artist || "Unknown Artist"}</p>
                  </div>
                </div>

                {/* Right duration & Remove action */}
                <div
                  className="flex items-center gap-3 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] font-mono text-neutral-400">
                    {Math.floor(t.duration / 60)}:
                    {(t.duration % 60).toString().padStart(2, "0")}
                  </span>

                  <button
                    onClick={() => handleRemoveTrack(t.id)}
                    className="p-1.5 text-neutral-400 hover:text-rose-400 transition-colors rounded-xl hover:bg-rose-500/15 cursor-pointer active:scale-90"
                    title="Remove from this playlist (audio file preserved in library)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link to Trip Vault Expedition Modal */}
      {showTripModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowTripModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl glass-card-premium border border-white/15 p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-white font-normal">
              Link to Trip Vault
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Select an expedition to make this playlist the official soundtrack for the journey.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-none">
              {trips.length === 0 ? (
                <p className="text-xs text-neutral-400 p-3 text-center">
                  No active expeditions found in Trip Vault.
                </p>
              ) : (
                trips.map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => handleLinkTrip(tr.id)}
                    className={`w-full p-3 rounded-2xl text-left text-xs font-semibold transition-all flex items-center justify-between cursor-pointer border ${
                      playlist.tripId === tr.id
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                        : "glass-card-subtle hover:bg-white/10 text-white border-white/5"
                    }`}
                  >
                    <span>{tr.title}</span>
                    <span className="text-[10px] font-mono text-neutral-400">{tr.destination}</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              {playlist.tripId && (
                <button
                  type="button"
                  onClick={handleUnlinkTrip}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 transition-colors cursor-pointer border border-rose-500/20 active:scale-95"
                >
                  Unlink
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTripModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer border border-white/10 active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
