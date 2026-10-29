"use client";

/**
 * Shared building blocks for the Atlas Music Vault multi-palette theme system.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
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

// Refined audiophile cover-art gradients (zero hot-pink / neon-purple)
const GRADIENTS = [
  "from-amber-600 via-yellow-700 to-stone-800",
  "from-emerald-600 via-teal-700 to-slate-800",
  "from-sky-600 via-cyan-700 to-slate-900",
  "from-slate-600 via-zinc-700 to-neutral-900",
  "from-orange-600 via-amber-700 to-stone-900",
  "from-rose-600 via-red-700 to-stone-900",
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
        <Music className={`${iconClass} text-white/85 drop-shadow`} />
      )}
    </div>
  );
}

export function Equalizer({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-end gap-[2px] h-3.5 ${className}`} aria-label="Playing">
      <span className="w-[3px] rounded-full bg-[var(--mv-accent)] animate-eq-1" />
      <span className="w-[3px] rounded-full bg-[var(--mv-accent)] opacity-80 animate-eq-2" />
      <span className="w-[3px] rounded-full bg-[var(--mv-accent-2)] animate-eq-3" />
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
          style={{
            background: "linear-gradient(to top, var(--mv-accent-2), var(--mv-accent))",
          }}
          className={`w-[3px] rounded-full transition-all ${
            playing ? anim : "h-1 opacity-40"
          }`}
        />
      ))}
    </span>
  );
}

/* ----------------------------------------------------------- playlist cover */

export function PlaylistCover({
  playlist,
  tracksById,
  className = "",
}: {
  playlist: MusicPlaylist;
  tracksById: Map<string, MusicTrack>;
  className?: string;
}) {
  const covers = playlist.trackIds
    .map((id) => tracksById.get(id))
    .filter((t): t is MusicTrack => !!t)
    .slice(0, 4);
  if (covers.length === 0) {
    return (
      <div className={`bg-gradient-to-br ${gradientFor(playlist.id)} flex items-center justify-center ${className}`}>
        <ListMusic className="w-1/3 h-1/3 text-white/85" />
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
        active ? "bg-[var(--mv-accent-soft)]" : "active:bg-[var(--mv-card-hover)]"
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
          <span className="w-5 text-center text-[11px] font-mono text-[var(--mv-text-subtle)] shrink-0">
            {active && isPlaying ? <Equalizer className="mx-auto" /> : index + 1}
          </span>
        )}
        <Artwork track={track} className="w-12 h-12 rounded-xl shrink-0" iconClass="w-5 h-5" />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[15px] font-semibold truncate ${
              active ? "text-[var(--mv-accent)]" : "text-[var(--mv-text)]"
            }`}
          >
            {track.title}
          </p>
          <p className="text-xs text-[var(--mv-text-muted)] truncate flex items-center gap-1.5">
            {hasLocalAudio(track) && (
              <HardDriveDownload className="w-3 h-3 text-emerald-500 shrink-0" />
            )}
            <span className="truncate">{track.artist || "Unknown Artist"}</span>
          </p>
        </div>
        <span className="text-[11px] font-mono text-[var(--mv-text-subtle)] shrink-0 pr-1">
          {formatTime(track.duration)}
        </span>
      </button>
      <button
        onClick={onMore}
        className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--mv-text-subtle)] active:bg-[var(--mv-card-hover)] active:text-[var(--mv-text)] shrink-0 cursor-pointer"
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
  useEffect(() => {
    if (!open) return;

    let appListenerHandle: PluginListenerHandle | null = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener("backButton", () => {
        onClose();
      })
        .then((h) => {
          appListenerHandle = h;
        })
        .catch(() => {});
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      appListenerHandle?.remove();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="music-theme fixed inset-0 z-[60] bg-black/65 backdrop-blur-md flex items-end justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--mv-bg-elevated)",
          borderColor: "var(--mv-border)",
        }}
        className="w-full max-w-lg rounded-t-[32px] backdrop-blur-2xl border-t shadow-[0_-20px_60px_rgba(0,0,0,0.45)] pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] px-4 max-h-[88vh] overflow-y-auto animate-sheet-up"
      >
        <div className="w-10 h-1 rounded-full bg-[var(--mv-border)] mx-auto mb-3" />
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
      className={`w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl text-left active:bg-[var(--mv-card-hover)] cursor-pointer ${
        danger ? "text-rose-500" : "text-[var(--mv-text)]"
      }`}
    >
      <Icon
        className={`w-5 h-5 shrink-0 ${
          active ? "text-[var(--mv-accent)] fill-[var(--mv-accent)]" : ""
        }`}
      />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-xs text-[var(--mv-text-subtle)] mt-0.5">{hint}</span>}
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
        setTimeout(onClose, 800);
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
        ? "The online copy will be removed from your cloud vault. The copy on this phone stays safe."
        : "This song only exists in the cloud, so it will be permanently deleted.",
      go: doDeleteCloud,
      cta: "Delete from cloud",
    },
    phone: {
      title: "Remove from this phone?",
      body: cloud
        ? "The audio file will be removed from this phone to free storage. Your cloud copy remains safe."
        : "No cloud copy exists, so the song will be deleted completely.",
      go: doRemovePhone,
      cta: "Remove offline file",
    },
    everywhere: {
      title: "Delete everywhere?",
      body: "This permanently deletes the song from your phone storage and from your cloud database.",
      go: doDeleteEverywhere,
      cta: "Delete everywhere",
    },
  };

  const formattedSize = track.size
    ? `${(track.size / (1024 * 1024)).toFixed(1)} MB`
    : null;
  const formatLabel = (track.format || "MP3").split("/").pop()?.toUpperCase() || "MP3";

  return (
    <Sheet open={!!track} onClose={onClose}>
      {/* Redesigned Cover Art & Metadata Hero Header */}
      <div className="flex items-start gap-3.5 pb-4 border-b border-[var(--mv-border)] mb-3">
        {view === "playlists" ? (
          <button
            onClick={() => {
              triggerHaptic("tap");
              setView("menu");
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--mv-text-muted)] bg-[var(--mv-input)] active:scale-95 cursor-pointer shrink-0 mt-1"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <Artwork
            track={track}
            className="w-16 h-16 rounded-2xl ring-1 ring-white/15 shadow-xl shrink-0 object-cover"
            iconClass="w-7 h-7"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-[var(--mv-text)] truncate leading-snug">
            {view === "playlists" ? "Add to playlist" : track.title}
          </p>
          <p className="text-xs text-[var(--mv-text-muted)] truncate mt-0.5">
            {view === "playlists" ? track.title : `${track.artist || "Unknown Artist"} · ${track.album || "Single"}`}
          </p>
          {/* Metadata & Storage Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--mv-input)] border border-[var(--mv-border)] text-[var(--mv-text-subtle)]">
              {formatLabel} {formattedSize ? `· ${formattedSize}` : ""}
            </span>
            {local && cloud && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Check className="w-3 h-3 stroke-[3]" /> Phone & Cloud
              </span>
            )}
            {local && !cloud && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <HardDriveDownload className="w-3 h-3" /> Phone only
              </span>
            )}
            {!local && cloud && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <Cloud className="w-3 h-3" /> Cloud stream
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--mv-text-subtle)] bg-[var(--mv-input)] active:scale-95 cursor-pointer shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {message && (
        <div className="mb-3 px-3.5 py-2.5 rounded-2xl bg-[var(--mv-card)] border border-[var(--mv-border-strong)] text-sm font-medium text-[var(--mv-text)] text-center animate-fade-in shadow-md">
          {message}
        </div>
      )}

      {confirm ? (
        <div className="p-2 space-y-4 animate-fade-in">
          <div className="p-4 rounded-2xl bg-[var(--mv-card)] border border-[var(--mv-border)] text-center space-y-2">
            <p className="text-base font-bold text-[var(--mv-text)]">{confirmCopy[confirm].title}</p>
            <p className="text-xs text-[var(--mv-text-muted)] leading-relaxed max-w-xs mx-auto">
              {confirmCopy[confirm].body}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                triggerHaptic("tap");
                setConfirm(null);
              }}
              disabled={busy}
              className="py-3.5 rounded-2xl bg-[var(--mv-input)] border border-[var(--mv-border)] text-[var(--mv-text)] font-semibold active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                triggerHaptic("error");
                confirmCopy[confirm].go();
              }}
              disabled={busy}
              className="py-3.5 rounded-2xl bg-rose-500 text-white font-bold active:scale-95 disabled:opacity-60 cursor-pointer shadow-lg shadow-rose-500/25"
            >
              {busy ? "Working…" : confirmCopy[confirm].cta}
            </button>
          </div>
        </div>
      ) : view === "playlists" ? (
        <div className="space-y-1.5 animate-fade-in">
          {playlists.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <p className="text-sm font-semibold text-[var(--mv-text)]">No playlists created yet</p>
              <p className="text-xs text-[var(--mv-text-muted)]">Create playlists from the Playlists tab to organize your music.</p>
            </div>
          ) : (
            playlists.map((pl) => {
              const inside = pl.trackIds.includes(track.id);
              return (
                <button
                  key={pl.id}
                  disabled={inside}
                  onClick={() => {
                    triggerHaptic("tap");
                    run(async () => {
                      await addTrackToPlaylist(pl.id, track.id);
                      return `Added to ${pl.title}`;
                    });
                  }}
                  className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left bg-[var(--mv-input)] border border-[var(--mv-border)] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
                >
                  <span className="w-10 h-10 rounded-xl bg-[var(--mv-card)] border border-[var(--mv-border)] flex items-center justify-center shrink-0">
                    <ListMusic className="w-5 h-5 text-[var(--mv-accent)]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[var(--mv-text)] truncate">{pl.title}</span>
                    <span className="block text-xs text-[var(--mv-text-muted)] mt-0.5">{pl.trackIds.length} tracks</span>
                  </span>
                  {inside ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <Check className="w-4 h-4 stroke-[3]" /> Added
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--mv-accent)] font-semibold">+ Add</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {/* Quick Action 4-Col Grid */}
          <div className="grid grid-cols-4 gap-2">
            {/* 1. Favorite / Liked */}
            <button
              onClick={async () => {
                triggerHaptic("tap");
                await toggleFavorite(track.id);
                setLiked(!liked);
                notifyLibraryChanged();
                onChanged();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--mv-input)] border border-[var(--mv-border)] active:scale-95 transition-transform cursor-pointer"
            >
              <Heart
                className={`w-5 h-5 ${
                  liked
                    ? "text-[var(--mv-accent)] fill-[var(--mv-accent)]"
                    : "text-[var(--mv-text-muted)]"
                }`}
              />
              <span className="text-[11px] font-semibold text-[var(--mv-text)] mt-1.5 truncate max-w-full">
                {liked ? "Liked" : "Like"}
              </span>
            </button>

            {/* 2. Play Next */}
            <button
              onClick={() => {
                triggerHaptic("tap");
                playNext(track);
                finish("Playing next");
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--mv-input)] border border-[var(--mv-border)] active:scale-95 transition-transform cursor-pointer"
            >
              <SkipForward className="w-5 h-5 text-[var(--mv-text)]" />
              <span className="text-[11px] font-semibold text-[var(--mv-text)] mt-1.5 truncate max-w-full">
                Play Next
              </span>
            </button>

            {/* 3. Add to Queue */}
            <button
              onClick={() => {
                triggerHaptic("tap");
                addToQueue(track);
                finish("Added to queue");
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--mv-input)] border border-[var(--mv-border)] active:scale-95 transition-transform cursor-pointer"
            >
              <ListPlus className="w-5 h-5 text-[var(--mv-text)]" />
              <span className="text-[11px] font-semibold text-[var(--mv-text)] mt-1.5 truncate max-w-full">
                Queue
              </span>
            </button>

            {/* 4. Add to Playlist */}
            <button
              onClick={() => {
                triggerHaptic("tap");
                setView("playlists");
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--mv-input)] border border-[var(--mv-border)] active:scale-95 transition-transform cursor-pointer"
            >
              <ListMusic className="w-5 h-5 text-[var(--mv-text)]" />
              <span className="text-[11px] font-semibold text-[var(--mv-text)] mt-1.5 truncate max-w-full">
                Playlist
              </span>
            </button>
          </div>

          {/* Cloud & Offline Sync Card */}
          {local && !cloud && (
            <div className="p-3.5 rounded-2xl bg-[var(--mv-card)] border border-[var(--mv-border-strong)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[var(--mv-accent-soft)] text-[var(--mv-accent)] flex items-center justify-center shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--mv-text)]">Back up to Cloud</p>
                  <p className="text-[11px] text-[var(--mv-text-muted)] truncate">Sync to Neon storage for cross-device access</p>
                </div>
              </div>
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  run(async () => {
                    const res = await uploadTrackToCloud(track, track.audioBlob);
                    if (!res.success) throw new Error("Cloud upload failed. Check connection.");
                    return "Uploaded to cloud successfully!";
                  });
                }}
                disabled={busy}
                className="px-3.5 py-2 rounded-xl bg-[var(--mv-primary-bg)] text-[var(--mv-primary-fg)] text-xs font-bold shrink-0 active:scale-95 transition-transform cursor-pointer shadow-sm"
              >
                Sync Now
              </button>
            </div>
          )}

          {!local && cloud && (
            <div className="p-3.5 rounded-2xl bg-[var(--mv-card)] border border-[var(--mv-border-strong)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <DownloadCloud className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--mv-text)]">Save to Phone</p>
                  <p className="text-[11px] text-[var(--mv-text-muted)] truncate">Make playable offline without data</p>
                </div>
              </div>
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  run(async () => {
                    await downloadTrackToLocalStorage({ ...track });
                    return "Saved to phone!";
                  });
                }}
                disabled={busy}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold shrink-0 active:scale-95 transition-transform cursor-pointer shadow-sm shadow-emerald-500/20"
              >
                Download
              </button>
            </div>
          )}

          {/* Structured Management Actions */}
          <div className="space-y-1 pt-1 border-t border-[var(--mv-border)]">
            {local && cloud && (
              <>
                <button
                  onClick={() => {
                    triggerHaptic("tap");
                    setConfirm("phone");
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-left active:bg-[var(--mv-card-hover)] cursor-pointer text-[var(--mv-text)]"
                >
                  <HardDriveDownload className="w-4 h-4 text-[var(--mv-text-muted)]" />
                  <span className="flex-1 text-sm font-medium">Remove offline file</span>
                  <span className="text-[11px] text-[var(--mv-text-subtle)]">Keep cloud copy</span>
                </button>

                <button
                  onClick={() => {
                    triggerHaptic("tap");
                    setConfirm("cloud");
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-left active:bg-[var(--mv-card-hover)] cursor-pointer text-amber-500"
                >
                  <Cloud className="w-4 h-4" />
                  <span className="flex-1 text-sm font-medium">Delete from cloud</span>
                  <span className="text-[11px] text-[var(--mv-text-subtle)]">Keep on phone</span>
                </button>

                <button
                  onClick={() => {
                    triggerHaptic("tap");
                    setConfirm("everywhere");
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-left active:bg-[var(--mv-card-hover)] cursor-pointer text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="flex-1 text-sm font-medium">Delete everywhere</span>
                  <span className="text-[11px] text-rose-500/60">Phone & cloud</span>
                </button>
              </>
            )}

            {local && !cloud && (
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  setConfirm("phone");
                }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-left active:bg-[var(--mv-card-hover)] cursor-pointer text-rose-500"
              >
                <Trash2 className="w-4 h-4" />
                <span className="flex-1 text-sm font-medium">Delete song</span>
                <span className="text-[11px] text-[var(--mv-text-subtle)]">From this phone</span>
              </button>
            )}

            {!local && cloud && (
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  setConfirm("cloud");
                }}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-left active:bg-[var(--mv-card-hover)] cursor-pointer text-rose-500"
              >
                <Trash2 className="w-4 h-4" />
                <span className="flex-1 text-sm font-medium">Delete from cloud</span>
                <span className="text-[11px] text-[var(--mv-text-subtle)]">From cloud vault</span>
              </button>
            )}
          </div>
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
      <div
        style={{ background: "var(--mv-accent-soft)", borderColor: "var(--mv-border)" }}
        className="w-20 h-20 rounded-[28px] border flex items-center justify-center mb-5"
      >
        <Music className="w-9 h-9 text-[var(--mv-accent)]" />
      </div>
      <h3 className="font-display text-xl text-[var(--mv-text)]">{title}</h3>
      <p className="text-sm text-[var(--mv-text-muted)] mt-1.5 max-w-xs">{body}</p>
      {cta && onCta && (
        <button
          onClick={onCta}
          style={{
            background: "linear-gradient(135deg, var(--mv-accent), var(--mv-accent-2))",
            color: "var(--mv-accent-fg)",
            boxShadow: "0 12px 28px -6px var(--mv-glow)",
          }}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm active:scale-95 transition-transform cursor-pointer"
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
      <h2 className="font-display text-[22px] text-[var(--mv-text)] leading-none">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs font-semibold text-[var(--mv-accent)] cursor-pointer">
          {action}
        </button>
      )}
    </div>
  );
}
