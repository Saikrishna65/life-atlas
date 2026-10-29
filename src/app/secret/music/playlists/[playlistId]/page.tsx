"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Play, Shuffle, MoreHorizontal, Compass, Download, Trash2, ArrowUp, ArrowDown, X, Pencil, Check } from "lucide-react";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getPlaylist,
  getAllTracks,
  reorderPlaylistTracks,
  removeTrackFromPlaylist,
  exportPlaylistM3U,
  linkPlaylistToTrip,
  unlinkPlaylistFromTrip,
  deletePlaylist,
} from "@/lib/music/storage";
import { getAllTrips } from "@/lib/vault/storage";
import { MusicPlaylist, MusicTrack } from "@/lib/music/types";
import { TripRecord } from "@/lib/vault/types";
import {
  Artwork,
  TrackRow,
  TrackActionSheet,
  Sheet,
  EmptyState,
  PlaylistCover,
  formatTime,
  useLibraryRefresh,
} from "@/components/music/ui";
import { triggerHaptic } from "@/lib/deviceAuth";

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = typeof params?.playlistId === "string" ? params.playlistId : "";
  const { playTrack } = useMusicPlayer();

  const [playlist, setPlaylist] = useState<MusicPlaylist | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<"closed" | "main" | "trip" | "delete">("closed");
  const [sheetTrack, setSheetTrack] = useState<MusicTrack | null>(null);

  const load = useCallback(async () => {
    if (!playlistId) return;
    const pl = await getPlaylist(playlistId);
    if (!pl) {
      router.replace("/secret/music/playlists");
      return;
    }
    setPlaylist(pl);
    const all = await getAllTracks();
    const byId = new Map(all.map((t) => [t.id, t]));
    setTracks(pl.trackIds.map((id) => byId.get(id)).filter((t): t is MusicTrack => !!t));
    getAllTrips().then(setTrips).catch(() => {});
  }, [playlistId, router]);

  useEffect(() => {
    load();
  }, [load]);
  useLibraryRefresh(load);

  if (!playlist) return <div className="py-24 text-center text-white/40 text-sm">Loading…</div>;

  const byId = new Map(tracks.map((t) => [t.id, t]));
  const linkedTrip = trips.find((t) => t.id === playlist.tripId);
  const totalSecs = tracks.reduce((s, t) => s + (t.duration || 0), 0);

  const play = (shuffle: boolean) => {
    if (!tracks.length) return;
    triggerHaptic("tap");
    const list = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
    playTrack(list[0], list, { type: "PLAYLIST", id: playlist.id, title: playlist.title });
  };

  const move = async (index: number, dir: -1 | 1) => {
    const ids = [...playlist.trackIds];
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await reorderPlaylistTracks(playlist.id, ids);
    load();
  };

  const exportM3U = () => {
    const m3u = exportPlaylistM3U(playlist, tracks);
    const url = URL.createObjectURL(new Blob([m3u], { type: "audio/x-mpegurl" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${playlist.title.replace(/\s+/g, "_")}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMenu("closed");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/secret/music/playlists")}
          className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center active:bg-white/10 cursor-pointer"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => setMenu("main")}
          className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/10 cursor-pointer"
          aria-label="Playlist options"
        >
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>

      <header className="flex flex-col items-center text-center">
        <PlaylistCover playlist={playlist} tracksById={byId} className="w-52 h-52 rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.55)]" />
        <h1 className="font-display text-3xl mt-5 leading-tight">{playlist.title}</h1>
        <p className="text-sm text-white/45 font-mono mt-1.5">
          {tracks.length} songs · {Math.round(totalSecs / 60)} min
        </p>
        {linkedTrip && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs text-white/70">
            <Compass className="w-3.5 h-3.5 text-amber-300" /> {linkedTrip.title}
          </span>
        )}
      </header>

      {tracks.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => play(false)} className="h-14 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <Play className="w-5 h-5 fill-current" /> Play
          </button>
          <button onClick={() => play(true)} className="h-14 rounded-2xl bg-white/10 border border-white/10 font-bold flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <Shuffle className="w-5 h-5" /> Shuffle
          </button>
        </div>
      )}

      {tracks.length === 0 ? (
        <EmptyState title="Empty playlist" body="Open any song's ⋮ menu in the Library and choose “Add to playlist”." />
      ) : (
        <div>
          <div className="flex justify-end mb-1">
            <button
              onClick={() => setEditing((v) => !v)}
              className="h-9 px-3.5 rounded-full bg-white/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              {editing ? "Done" : "Edit"}
            </button>
          </div>
          <div className="space-y-0.5">
            {tracks.map((t, i) =>
              editing ? (
                <div key={t.id} className="flex items-center gap-2 px-2 py-2 rounded-2xl bg-white/[0.04]">
                  <Artwork track={t} className="w-11 h-11 rounded-xl shrink-0" iconClass="w-4 h-4" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{t.title}</p>
                    <p className="text-xs text-white/45 truncate">{formatTime(t.duration)}</p>
                  </div>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-20 active:bg-white/10 cursor-pointer" aria-label="Move up">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === tracks.length - 1} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-20 active:bg-white/10 cursor-pointer" aria-label="Move down">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      await removeTrackFromPlaylist(playlist.id, t.id);
                      load();
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-rose-400 active:bg-white/10 cursor-pointer"
                    aria-label="Remove from playlist"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i}
                  onPlay={() => playTrack(t, tracks, { type: "PLAYLIST", id: playlist.id, title: playlist.title })}
                  onMore={() => setSheetTrack(t)}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* Playlist menu */}
      <Sheet open={menu !== "closed"} onClose={() => setMenu("closed")}>
        {menu === "main" && (
          <div>
            <h3 className="font-display text-xl px-1 mb-2 truncate">{playlist.title}</h3>
            <button onClick={() => setMenu("trip")} className="w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl active:bg-white/10 text-left cursor-pointer">
              <Compass className="w-5 h-5" />
              <span className="text-[15px] font-medium">{linkedTrip ? "Change linked trip" : "Link to a trip"}</span>
            </button>
            <button onClick={exportM3U} disabled={!tracks.length} className="w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl active:bg-white/10 text-left disabled:opacity-40 cursor-pointer">
              <Download className="w-5 h-5" />
              <span className="text-[15px] font-medium">Export as M3U</span>
            </button>
            <div className="h-px bg-white/10 my-2" />
            <button onClick={() => setMenu("delete")} className="w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl active:bg-white/10 text-left text-rose-400 cursor-pointer">
              <Trash2 className="w-5 h-5" />
              <span className="text-[15px] font-medium">Delete playlist</span>
            </button>
          </div>
        )}
        {menu === "trip" && (
          <div>
            <h3 className="font-display text-xl px-1 mb-2">Link to a trip</h3>
            {trips.length === 0 && <p className="text-sm text-white/45 p-3">No trips found in Trip Vault.</p>}
            {trips.map((tr) => (
              <button
                key={tr.id}
                onClick={async () => {
                  await linkPlaylistToTrip(playlist.id, tr.id);
                  setMenu("closed");
                  load();
                }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-left active:bg-white/10 cursor-pointer ${
                  playlist.tripId === tr.id ? "bg-white/10" : ""
                }`}
              >
                <span className="text-[15px] font-medium truncate">{tr.title}</span>
                <span className="text-xs text-white/40 truncate ml-3">{tr.destination}</span>
              </button>
            ))}
            {playlist.tripId && (
              <button
                onClick={async () => {
                  await unlinkPlaylistFromTrip(playlist.id);
                  setMenu("closed");
                  load();
                }}
                className="w-full mt-2 py-3.5 rounded-2xl bg-white/10 text-sm font-semibold cursor-pointer"
              >
                Unlink trip
              </button>
            )}
          </div>
        )}
        {menu === "delete" && (
          <div className="p-2 space-y-4">
            <div>
              <p className="font-semibold">Delete this playlist?</p>
              <p className="text-sm text-white/50 mt-1">Your songs stay in the library.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMenu("main")} className="py-3.5 rounded-2xl bg-white/10 font-semibold cursor-pointer">Cancel</button>
              <button
                onClick={async () => {
                  await deletePlaylist(playlist.id);
                  router.replace("/secret/music/playlists");
                }}
                className="py-3.5 rounded-2xl bg-rose-500 font-semibold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <TrackActionSheet track={sheetTrack} onClose={() => setSheetTrack(null)} onChanged={load} />
    </div>
  );
}
