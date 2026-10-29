"use client";

/**
 * Shared building blocks for the Atlas Sonic music theme.
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Play,
  Heart,
  ListPlus,
  ListMusic,
  SkipForward,
  DownloadCloud,
  UploadCloud,
  HardDriveDownload,
  Cloud,
  Trash2,
  X,
  Music,
  MoreVertical,
  Check,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import {
  getAllPlaylists,
  addTrackToPlaylist,
  deleteTrack,
  saveTrack,
} from "@/lib/music/storage";
import {
  deleteTrackFromCloud,
  downloadTrackToLocalStorage,
  uploadTrackToCloud,
} from "@/lib/music/cloudSync";
import { triggerHaptic } from "@/lib/deviceAuth";

/* ------------------------------------------------------------------ helpers */

export function formatTime(secs?: number): string {
  if (!secs || !Number.isFinite(secs) || secs <= 0) return "0:00";
  const s = Math.round(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`
    : `${m}:${r.toString().padStart(2, "0")}`;
}

export function hasLocalAudio(t: MusicTrack): boolean {
  return !!t.audioBlob && (t.audioBlob.size || 0) > 0;
}

export function hasCloudCopy(t: MusicTrack): boolean {
  return t.syncedToCloud === true || Boolean(t.audioUrl);
}

const GRADIENTS = [
  "from-fuchsia-500 via-purple-600 to-indigo-700",
  "from-amber-400 via-orange-500 to-rose-600",
  "from-cyan-400 via-sky-500 to-blue-700",
  "from-emerald-400 via-teal-500 to-cyan-700",
  "from-pink-500 via-rose-500 to-orange-500",
  "from-violet-500 via-indigo-500 to-sky-500",
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Subscribe to library changes (imports, deletes, edits). */
export function useLibraryRefresh(reload: () => void): void {
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener("lifeatlas_tracks_updated", handler);
    return () => window.removeEventListener("lifeatlas_tracks_updated", handler);
  }, [reload]);
}

export function notifyLibraryChanged(): void {
  window.dispatchEvent(new Event("lifeatlas_tracks_updated"));
}

export function openAddSheet(): void {
  window.dispatchEvent(new Event("lifeatlas_music_add"));
}

/* ------------------------------------------------------------------ artwork */

export function Artwork({
  track,
  className = "",
  iconClass = "w-1/3 h-1/3",
}: {
  track: Pick<MusicTrack, "artworkUrl" | "title" | "id">;
  className?: string;
  iconClass?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${gradientFor(
        track.id || track.title
      )} ring-1 ring-inset ring-white/15 flex items-center justify-center ${className}`}
    >
      {track.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.artworkUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <Music className={`${iconClass} text-white/80 drop-shadow`} />
      )}
    </div>
  );
}

export function Equalizer({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-end gap-[2px] h-3.5 ${className}`} aria-label="Playing">
      <span className="w-[3px] rounded-full bg-fuchsia-400 animate-eq-1" />
      <span className="w-[3px] rounded-full bg-amber-300 animate-eq-2" />
      <span className="w-[3px] rounded-full bg-cyan-300 animate-eq-3" />
    </span>
  );
}

export function SpectrumBars({
  playing,
  className = "",
}: {
  playing: boolean;
  className?: string;
}) {
  const anims = [
    "animate-eq-1",
    "animate-eq-4",
    "animate-eq-2",
    "animate-eq-5",
    "animate-eq-3",
    "animate-eq-7",
    "animate-eq-6",
    "animate-eq-8",
  ];
  return (
    <span className={`inline-flex items-end gap-[3px] h-5 ${className}`} aria-hidden="true">
      {anims.map((anim, idx) => (
        <span
          key={idx}
          className={`w-[3px] rounded-full bg-gradient-to-t from-fuchsia-400 via-purple-300 to-cyan-300 transition-all ${
            playing ? anim : "h-1 opacity-40"
          }`}
        />
      ))}
    </span>
  );
}

/* ----------------------------------------------------------- playlist cover */

export function PlaylistCover({ playlist, tracksById, className = "" }: { playlist: MusicPlaylist; tracksById: Map<string, MusicTrack>; className?: string }) {
  const covers = playlist.trackIds
    .map((id) => tracksById.get(id))
    .filter((t): t is MusicTrack => !!t)
    .slice(0, 4);
  if (covers.length === 0) {
    return (
      <div className={`bg-gradient-to-br ${gradientFor(playlist.id)} flex items-center justify-center ${className}`}>
        <ListMusic className="w-1/3 h-1/3 text-white/80" />
      </div>
    );
  }
  if (covers.length < 4) {
    return <Artwork track={covers[0]} className={className} />;
  }
  return (
    <div className={`grid grid-cols-2 overflow-hidden ${className}`}>
      {covers.map((t) => (
        <Artwork key={t.id} track={t} className="w-full h-full" iconClass="w-1/3 h-1/3" />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- track row */

export function TrackRow({
  track,
  index,
  onPlay,
  onMore,
}: {
  track: MusicTrack;
  index?: number;
  onPlay: () => void;
  onMore: () => void;
}) {
  const { currentTrack, isPlaying } = useMusicPlayer();
  const active = currentTrack?.id === track.id;
  return (
    <div
      className={`group flex items-center gap-3 pl-2 pr-1 py-2 rounded-2xl transition-colors ${
        active ? "bg-white/[0.08]" : "active:bg-white/[0.06]"
      }`}
    >
      <button
        onClick={() => {
          triggerHaptic("tap");
          onPlay();
        }}
        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
      >
        {index !== undefined && (
          <span className="w-5 text-center text-[11px] font-mono text-white/30 shrink-0">
            {active && isPlaying ? <Equalizer className="mx-auto" /> : index + 1}
          </span>
        )}
        <Artwork track={track} className="w-12 h-12 rounded-xl shrink-0" iconClass="w-5 h-5" />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[15px] font-semibold truncate ${
              active ? "text-fuchsia-300" : "text-white"
            }`}
          >
            {track.title}
          </p>
          <p className="text-xs text-white/50 truncate flex items-center gap-1.5">
            {hasLocalAudio(track) && (
              <HardDriveDownload className="w-3 h-3 text-emerald-400/80 shrink-0" />
            )}
            <span className="truncate">{track.artist || "Unknown Artist"}</span>
          </p>
        </div>
        <span className="text-[11px] font-mono text-white/35 shrink-0 pr-1">
          {formatTime(track.duration)}
        </span>
      </button>
      <button
        onClick={onMore}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 active:bg-white/10 active:text-white shrink-0 cursor-pointer"
        aria-label="Song options"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- bottom sheet */

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="sonic-dark fixed inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-end justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[32px] bg-[#12121b]/98 backdrop-blur-2xl border-t border-white/15 shadow-[0_-20px_60px_rgba(0,0,0,0.75)] pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] px-4 max-h-[88vh] overflow-y-auto animate-sheet-up"
      >
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-3" />
        {children}
      </div>
    </div>
  );
}

function SheetAction({
  icon: Icon,
  label,
  hint,
  onClick,
  danger,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl text-left active:bg-white/10 cursor-pointer ${
        danger ? "text-rose-400" : "text-white"
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${active ? "text-fuchsia-400 fill-fuchsia-400" : ""}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-xs text-white/40 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

/* ------------------------------------------------------- track action sheet */

type ConfirmKind = "cloud" | "phone" | "everywhere" | null;

export function TrackActionSheet({
  track,
  onClose,
  onChanged,
}: {
  track: MusicTrack | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { playNext, addToQueue, toggleFavorite } = useMusicPlayer();
  const [view, setView] = useState<"menu" | "playlists">("menu");
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (track) {
      setView("menu");
      setConfirm(null);
      setMessage(null);
      setBusy(false);
      setLiked(track.isFavorite);
      getAllPlaylists().then(setPlaylists).catch(() => {});
    }
  }, [track]);

  const finish = useCallback(
    (msg?: string) => {
      notifyLibraryChanged();
      onChanged();
      if (msg) {
        setMessage(msg);
        setTimeout(onClose, 900);
      } else {
        onClose();
      }
    },
    [onChanged, onClose]
  );

  if (!track) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const local = hasLocalAudio(track);
  const cloud = hasCloudCopy(track);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    try {
      const msg = await fn();
      finish(msg || undefined);
    } catch (e) {
      setBusy(false);
      setMessage(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const doDeleteCloud = () =>
    run(async () => {
      const ok = await deleteTrackFromCloud(track.id);
      if (!ok) throw new Error("Could not reach the cloud. Try again online.");
      if (local) {
        const t = { ...track, syncedToCloud: false };
        delete t.audioUrl;
        delete t.streamUrl;
        await saveTrack(t);
      } else {
        await deleteTrack(track.id, false);
      }
      return "Deleted from cloud";
    });

  const doRemovePhone = () =>
    run(async () => {
      if (cloud) {
        const t = { ...track, source: "STREAM" as const, downloadStatus: "IDLE" as const };
        delete t.audioBlob;
        await saveTrack(t);
      } else {
        await deleteTrack(track.id, false);
      }
      return "Removed from phone";
    });

  const doDeleteEverywhere = () =>
    run(async () => {
      await deleteTrack(track.id, true);
      return "Song deleted";
    });

  const confirmCopy: Record<Exclude<ConfirmKind, null>, { title: string; body: string; go: () => void; cta: string }> = {
    cloud: {
      title: "Delete from cloud?",
      body: local
        ? "The online copy will be removed. Your copy on this phone stays."
        : "This song only exists in the cloud, so it will be gone completely.",
      go: doDeleteCloud,
      cta: "Delete from cloud",
    },
    phone: {
      title: "Remove from this phone?",
      body: cloud
        ? "The cloud copy stays and you can save it offline again later."
        : "No cloud copy exists, so the song will be deleted completely.",
      go: doRemovePhone,
      cta: "Remove",
    },
    everywhere: {
      title: "Delete everywhere?",
      body: "This permanently deletes the song from your phone and from the cloud.",
      go: doDeleteEverywhere,
      cta: "Delete everywhere",
    },
  };

  return (
    <Sheet open={!!track} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-2">
        {view === "playlists" ? (
          <button
            onClick={() => setView("menu")}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:bg-white/10 cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <Artwork track={track} className="w-12 h-12 rounded-xl shrink-0" iconClass="w-5 h-5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white truncate">
            {view === "playlists" ? "Add to playlist" : track.title}
          </p>
          <p className="text-xs text-white/45 truncate">
            {view === "playlists" ? track.title : track.artist}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 active:bg-white/10 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {message && (
        <div className="mb-2 px-3 py-2.5 rounded-xl bg-white/10 text-sm text-white/90">{message}</div>
      )}

      {confirm ? (
        <div className="p-3 space-y-4">
          <div>
            <p className="text-white font-semibold">{confirmCopy[confirm].title}</p>
            <p className="text-sm text-white/55 mt-1">{confirmCopy[confirm].body}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setConfirm(null)}
              disabled={busy}
              className="py-3.5 rounded-2xl bg-white/10 text-white font-semibold active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmCopy[confirm].go}
              disabled={busy}
              className="py-3.5 rounded-2xl bg-rose-500 text-white font-semibold active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {busy ? "Working…" : confirmCopy[confirm].cta}
            </button>
          </div>
        </div>
      ) : view === "playlists" ? (
        <div className="space-y-1">
          {playlists.length === 0 ? (
            <p className="text-sm text-white/45 p-4 text-center">
              No playlists yet. Create one from the Playlists tab.
            </p>
          ) : (
            playlists.map((pl) => {
              const inside = pl.trackIds.includes(track.id);
              return (
                <button
                  key={pl.id}
                  disabled={inside}
                  onClick={() =>
                    run(async () => {
                      await addTrackToPlaylist(pl.id, track.id);
                      return `Added to ${pl.title}`;
                    })
                  }
                  className="w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl text-left active:bg-white/10 disabled:opacity-50 cursor-pointer"
                >
                  <ListMusic className="w-5 h-5 text-white/70" />
                  <span className="flex-1 text-[15px] text-white truncate">{pl.title}</span>
                  {inside ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span className="text-xs text-white/35">{pl.trackIds.length}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div>
          <SheetAction
            icon={SkipForward}
            label="Play next"
            onClick={() => {
              playNext(track);
              finish("Playing next");
            }}
          />
          <SheetAction
            icon={ListPlus}
            label="Add to queue"
            onClick={() => {
              addToQueue(track);
              finish("Added to queue");
            }}
          />
          <SheetAction
            icon={Heart}
            active={liked}
            label={liked ? "Remove from liked" : "Add to liked"}
            onClick={async () => {
              await toggleFavorite(track.id);
              setLiked(!liked);
              notifyLibraryChanged();
              onChanged();
            }}
          />
          <SheetAction icon={ListMusic} label="Add to playlist" onClick={() => setView("playlists")} />
          {!local && cloud && (
            <SheetAction
              icon={DownloadCloud}
              label="Save to phone"
              hint="Listen offline"
              onClick={() =>
                run(async () => {
                  await downloadTrackToLocalStorage({ ...track });
                  return "Saved to phone";
                })
              }
            />
          )}
          {local && !cloud && (
            <SheetAction
              icon={UploadCloud}
              label="Back up to cloud"
              hint="Sync online so you never lose it"
              onClick={() =>
                run(async () => {
                  const res = await uploadTrackToCloud(track, track.audioBlob);
                  if (!res.success) {
                    throw new Error("Cloud upload failed (files over 4.5 MB stay offline-only).");
                  }
                  return "Backed up to cloud";
                })
              }
            />
          )}

          <div className="h-px bg-white/10 my-2" />

          {local && cloud && (
            <>
              <SheetAction
                icon={HardDriveDownload}
                label="Remove from phone"
                hint="Keep the cloud copy"
                onClick={() => setConfirm("phone")}
              />
              <SheetAction
                icon={Cloud}
                label="Delete from cloud"
                hint="Keep the copy on this phone"
                onClick={() => setConfirm("cloud")}
                danger
              />
              <SheetAction
                icon={Trash2}
                label="Delete everywhere"
                onClick={() => setConfirm("everywhere")}
                danger
              />
            </>
          )}
          {local && !cloud && (
            <SheetAction
              icon={Trash2}
              label="Delete song"
              hint="Removes it from this phone"
              onClick={() => setConfirm("phone")}
              danger
            />
          )}
          {!local && cloud && (
            <SheetAction
              icon={Cloud}
              label="Delete from cloud"
              hint="Removes the song completely"
              onClick={() => setConfirm("cloud")}
              danger
            />
          )}
          {!local && !cloud && (
            <SheetAction
              icon={Trash2}
              label="Delete song"
              onClick={() => setConfirm("everywhere")}
              danger
            />
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------- misc blocks */

export function EmptyState({
  title,
  body,
  cta,
  onCta,
}: {
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-fuchsia-500/30 to-indigo-500/20 border border-white/10 flex items-center justify-center mb-5">
        <Music className="w-9 h-9 text-fuchsia-300" />
      </div>
      <h3 className="font-display text-xl text-white">{title}</h3>
      <p className="text-sm text-white/50 mt-1.5 max-w-xs">{body}</p>
      {cta && onCta && (
        <button
          onClick={onCta}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 text-white font-semibold text-sm shadow-[0_10px_30px_rgba(168,85,247,0.4)] active:scale-95 transition-transform cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          {cta}
        </button>
      )}
    </div>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-end justify-between px-1 mb-3">
      <h2 className="font-display text-[22px] text-white leading-none">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs font-semibold text-fuchsia-300 cursor-pointer">
          {action}
        </button>
      )}
    </div>
  );
}
