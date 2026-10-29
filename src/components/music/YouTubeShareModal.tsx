"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  ClipboardPaste,
  DownloadCloud,
  ListMusic,
  Plus,
} from "lucide-react";
import { extractYouTubeVideoId } from "@/lib/music/youtubeExtractor";
import { extractAudioDuration, formatDuration } from "@/lib/music/metadataParser";
import { saveTrack, getAllPlaylists, savePlaylist, addTrackToPlaylist } from "@/lib/music/storage";
import { downloadTrackToLocalStorage, uploadTrackToCloud } from "@/lib/music/cloudSync";
import {
  canExtractOnDevice,
  extractAudioOnDevice,
  fetchYouTubePreviewOnDevice,
} from "@/lib/music/clientYouTube";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { triggerHaptic } from "@/lib/deviceAuth";
import { Artwork } from "@/components/music/ui";

interface YouTubeShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  onSuccess?: (track: MusicTrack, playlist?: MusicPlaylist | null) => void;
}

type Dest = "NONE" | "EXISTING" | "NEW";

export default function YouTubeShareModal({
  isOpen,
  onClose,
  initialUrl = "",
  onSuccess,
}: YouTubeShareModalProps) {
  const { playTrack } = useMusicPlayer();

  const [url, setUrl] = useState(initialUrl);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [dest, setDest] = useState<Dest>("NONE");
  const [selectedPl, setSelectedPl] = useState("");
  const [newPlTitle, setNewPlTitle] = useState("");

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<MusicTrack | null>(null);

  useEffect(() => {
    if (isOpen) {
      getAllPlaylists()
        .then((pls) => {
          setPlaylists(pls);
          setSelectedPl((cur) => cur || pls[0]?.id || "");
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleUrl = useCallback(async (value: string) => {
    setUrl(value);
    setError(null);
    setDone(null);
    const vid = extractYouTubeVideoId(value);
    setVideoId(vid);
    if (!vid) {
      setTitle("");
      setArtist("");
      setThumb(null);
      return;
    }
    setThumb(`https://img.youtube.com/vi/${vid}/hqdefault.jpg`);
    setLoadingPreview(true);
    try {
      // Fast on-device preview first (zero server roundtrip on Android)
      const localPreview = await fetchYouTubePreviewOnDevice(vid);
      if (localPreview) {
        setTitle(localPreview.title);
        setArtist(localPreview.artist);
        setThumb(localPreview.thumbnailUrl);
        return;
      }

      const res = await fetch(`/api/music/youtube?url=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.metadata) {
          setTitle(data.metadata.title);
          setArtist(data.metadata.artist);
          if (data.metadata.thumbnailUrl) setThumb(data.metadata.thumbnailUrl);
        }
      }
    } catch {
      /* preview is optional */
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (initialUrl.trim()) handleUrl(initialUrl);
    else {
      setUrl("");
      setVideoId(null);
      setTitle("");
      setArtist("");
      setThumb(null);
      setDone(null);
      setError(null);
      setWorking(false);
      setProgress(0);
    }
  }, [isOpen, initialUrl, handleUrl]);

  const reset = () => {
    setUrl("");
    setVideoId(null);
    setTitle("");
    setArtist("");
    setThumb(null);
    setDone(null);
    setError(null);
    setNewPlTitle("");
    setDest("NONE");
    setProgress(0);
  };
  const close = () => {
    if (working) return;
    reset();
    onClose();
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) handleUrl(text);
    } catch {
      setError("Clipboard access was blocked. Long-press the box and choose Paste.");
    }
  };

  const extract = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic("tap");
    if (!videoId) {
      setError("Paste a valid YouTube link first.");
      return;
    }
    setWorking(true);
    setError(null);
    setProgress(5);
    setStep("Connecting to YouTube…");

    try {
      if (canExtractOnDevice()) {
        setStep("Downloading high-fidelity audio…");
        const result = await extractAudioOnDevice(videoId, (p) => {
          setProgress(Math.max(8, p));
          setStep(`Downloading audio… ${p}%`);
        });
        setProgress(99);
        setStep("Saving to offline vault…");
        let duration = result.duration;
        if (!duration) duration = await extractAudioDuration(result.blob).catch(() => 0);

        const ext = result.mimeType.includes("webm") ? "webm" : "m4a";
        const id = `trk_yt_${videoId}_${Date.now()}`;
        const track: MusicTrack = {
          id,
          title: title.trim() || result.title || `YouTube Audio (${videoId})`,
          artist: artist.trim() || result.author || "YouTube",
          album: "YouTube",
          genre: "YouTube",
          duration,
          format: result.mimeType,
          size: result.blob.size,
          artworkUrl: thumb || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          audioBlob: result.blob,
          source: "DOWNLOADED",
          downloadStatus: "DOWNLOADED",
          downloadProgress: 100,
          isFavorite: false,
          playCount: 0,
          addedAt: Date.now(),
          fileName: `${id}.${ext}`,
        };
        await saveTrack(track);

        if (dest === "NEW" && newPlTitle.trim()) {
          await savePlaylist({
            id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: newPlTitle.trim(),
            trackIds: [id],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } else if (dest === "EXISTING" && selectedPl) {
          await addTrackToPlaylist(selectedPl, id);
        }

        uploadTrackToCloud(track, result.blob).catch(() => {});
        window.dispatchEvent(new Event("lifeatlas_tracks_updated"));
        setProgress(100);
        setDone(track);
        triggerHaptic("success");
        onSuccess?.(track, null);
        return;
      }

      // Browser fallback (desktop testing): server-side extraction
      setStep("Extracting audio stream…");
      setProgress(25);
      const res = await fetch("/api/music/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          customTitle: title,
          customArtist: artist,
          playlistId: dest === "EXISTING" ? selectedPl : undefined,
          newPlaylistTitle: dest === "NEW" ? newPlTitle : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server responded with ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || !data.track) throw new Error(data.error || "Extraction failed");

      setProgress(85);
      let blob: Blob | undefined;
      if (typeof data.audioBase64 === "string") {
        const bin = atob(data.audioBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: data.mimeType || "audio/mp4" });
      }
      let duration = Number(data.duration || data.track.duration || 0);
      if (blob && !duration) duration = await extractAudioDuration(blob).catch(() => 0);

      const track: MusicTrack = {
        ...data.track,
        duration,
        size: blob ? blob.size : Number(data.size || 0),
        format: data.mimeType || data.track.format || "audio/mp4",
        audioBlob: blob,
        source: "DOWNLOADED",
        downloadStatus: blob ? "DOWNLOADED" : "DOWNLOADING",
        addedAt: Date.now(),
      };
      await saveTrack(track);
      if (!track.audioBlob) await downloadTrackToLocalStorage(track);
      if (!track.audioBlob || track.audioBlob.size < 1000) throw new Error("Downloaded audio was empty.");
      if (data.playlist) await savePlaylist(data.playlist, false);
      else if (dest === "EXISTING" && selectedPl) await addTrackToPlaylist(selectedPl, track.id);

      window.dispatchEvent(new Event("lifeatlas_tracks_updated"));
      setProgress(100);
      setDone(track);
      triggerHaptic("success");
      onSuccess?.(track, data.playlist);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audio extraction failed");
      triggerHaptic("error");
    } finally {
      setWorking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="sonic-dark fixed inset-0 z-[55] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Import from YouTube"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] bg-[#12121b]/98 backdrop-blur-2xl text-white border border-white/15 shadow-2xl pt-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] px-5 max-h-[92vh] overflow-y-auto animate-sheet-up"
      >
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] tracking-[0.22em] uppercase text-fuchsia-300/80 font-semibold">
              YouTube Extractor
            </p>
            <h3 className="font-display text-2xl text-white mt-0.5">Save audio offline</h3>
          </div>
          <button
            onClick={close}
            disabled={working}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-40 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4 space-y-5">
            <Artwork
              track={done}
              className="w-40 h-40 rounded-[28px] mx-auto shadow-2xl"
              iconClass="w-10 h-10"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-semibold mb-1.5">
                <CheckCircle2 className="w-4 h-4" /> Saved to your vault
              </div>
              <p className="font-display text-xl text-white truncate">{done.title}</p>
              <p className="text-sm text-white/55 truncate">{done.artist}</p>
              <p className="text-xs font-mono text-white/40 mt-1.5">
                {formatDuration(done.duration || 0)} · {((done.size || 0) / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="h-14 rounded-2xl bg-white/10 font-semibold cursor-pointer"
              >
                Done
              </button>
              <button
                onClick={() => {
                  playTrack(done, [done], { type: "LIBRARY", title: "YouTube" });
                  reset();
                  onClose();
                }}
                className="h-14 rounded-2xl bg-white text-[#05050a] font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" /> Play now
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={extract} className="space-y-4">
            {error && (
              <div className="flex gap-2.5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-sm text-rose-200">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="relative">
              <input
                value={url}
                onChange={(e) => handleUrl(e.target.value)}
                disabled={working}
                placeholder="Paste YouTube video or Shorts link"
                inputMode="url"
                className="w-full h-14 pl-5 pr-28 rounded-2xl bg-white/[0.07] border border-white/10 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/60"
              />
              <button
                type="button"
                onClick={paste}
                disabled={working}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-3.5 rounded-xl bg-white/12 text-xs font-bold text-white flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                {loadingPreview ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardPaste className="w-4 h-4" />
                )}
                Paste
              </button>
            </div>

            {videoId && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.05] border border-white/10">
                <div className="w-20 h-16 rounded-xl overflow-hidden bg-white/10 shrink-0">
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={working}
                    placeholder="Song title"
                    className="w-full h-9 px-3 rounded-lg bg-black/35 border border-white/10 text-sm font-semibold text-white focus:outline-none focus:border-fuchsia-400/60"
                  />
                  <input
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    disabled={working}
                    placeholder="Artist"
                    className="w-full h-9 px-3 rounded-lg bg-black/35 border border-white/10 text-xs text-white/75 focus:outline-none focus:border-fuchsia-400/60"
                  />
                </div>
              </div>
            )}

            {/* Optional playlist */}
            <div>
              <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ListMusic className="w-3.5 h-3.5" /> Add to playlist{" "}
                <span className="normal-case tracking-normal font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["NONE", "None"],
                    ["EXISTING", "Existing"],
                    ["NEW", "New"],
                  ] as [Dest, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={working || (key === "EXISTING" && playlists.length === 0)}
                    onClick={() => setDest(key)}
                    className={`h-11 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-30 cursor-pointer ${
                      dest === key
                        ? "bg-fuchsia-500 border-fuchsia-400 text-white"
                        : "bg-white/[0.06] border-white/10 text-white/60"
                    }`}
                  >
                    {key === "NEW" && <Plus className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" />}
                    {label}
                  </button>
                ))}
              </div>
              {dest === "EXISTING" && (
                <select
                  value={selectedPl}
                  onChange={(e) => setSelectedPl(e.target.value)}
                  disabled={working}
                  className="mt-2 w-full h-12 px-4 rounded-xl bg-[#1d1d28] border border-white/10 text-sm text-white"
                >
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.trackIds.length})
                    </option>
                  ))}
                </select>
              )}
              {dest === "NEW" && (
                <input
                  value={newPlTitle}
                  onChange={(e) => setNewPlTitle(e.target.value)}
                  disabled={working}
                  placeholder="Playlist name"
                  className="mt-2 w-full h-12 px-4 rounded-xl bg-white/[0.07] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-fuchsia-400/60"
                />
              )}
            </div>

            {working && (
              <div className="p-3.5 rounded-2xl bg-fuchsia-500/12 border border-fuchsia-400/25 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-white">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-300 shrink-0" />
                    {step}
                  </span>
                  <span className="font-mono text-fuchsia-200">{progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-300 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!videoId || working}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 text-white font-bold flex items-center justify-center gap-2 shadow-[0_12px_30px_rgba(168,85,247,0.35)] disabled:opacity-40 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <DownloadCloud className="w-5 h-5" />
              {working ? "Extracting audio…" : "Extract & save to vault"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
