"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  X,
  Sparkles,
  DownloadCloud,
  CheckCircle2,
  Plus,
  Play,
  ListMusic,
  ArrowRight,
  Music,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { YoutubeIcon } from "./YoutubeIcon";
import { extractYouTubeVideoId } from "@/lib/music/youtubeExtractor";
import { extractAudioDuration, formatDuration } from "@/lib/music/metadataParser";
import { saveTrack, getAllPlaylists, savePlaylist, addTrackToPlaylist } from "@/lib/music/storage";
import { downloadTrackToLocalStorage } from "@/lib/music/cloudSync";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";
import { triggerHaptic } from "@/lib/deviceAuth";

interface YouTubeShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  onSuccess?: (track: MusicTrack, playlist?: MusicPlaylist | null) => void;
}

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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
  const [playlistMode, setPlaylistMode] = useState<"NONE" | "EXISTING" | "NEW">("NONE");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStep, setExtractionStep] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedTrack, setExtractedTrack] = useState<MusicTrack | null>(null);

  // Load user playlists
  useEffect(() => {
    if (isOpen) {
      getAllPlaylists()
        .then((pls) => {
          setPlaylists(pls);
          if (pls.length > 0 && !selectedPlaylistId) {
            setSelectedPlaylistId(pls[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, selectedPlaylistId]);

  // Handle URL change & auto-preview
  const handleUrlChange = useCallback(async (newUrl: string) => {
    setUrl(newUrl);
    setErrorMessage(null);
    setExtractedTrack(null);

    const vid = extractYouTubeVideoId(newUrl);
    setVideoId(vid);

    if (!vid) {
      setTitle("");
      setArtist("");
      setThumbnailUrl(null);
      return;
    }

    setIsLoadingPreview(true);
    setThumbnailUrl(`https://img.youtube.com/vi/${vid}/hqdefault.jpg`);

    try {
      const res = await fetch(`/api/music/youtube?url=${encodeURIComponent(newUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.metadata) {
          setTitle(data.metadata.title);
          setArtist(data.metadata.artist);
          if (data.metadata.thumbnailUrl) {
            setThumbnailUrl(data.metadata.thumbnailUrl);
          }
        }
      }
    } catch {
      // Fallback to parsed defaults
      setTitle("YouTube Audio");
      setArtist("YouTube");
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialUrl && initialUrl.trim().length > 0) {
        handleUrlChange(initialUrl);
      } else {
        setUrl("");
        setVideoId(null);
        setTitle("");
        setArtist("");
        setThumbnailUrl(null);
        setExtractedTrack(null);
        setErrorMessage(null);
        setIsExtracting(false);
      }
    }
  }, [isOpen, initialUrl, handleUrlChange]);

  // Extract Audio & Save
  const handleExtractAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic("tap");
    if (!videoId) {
      setErrorMessage("Please provide a valid YouTube link or video ID.");
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);
    setExtractionStep("Connecting to YouTube audio engine...");

    try {
      setExtractionStep("Extracting audio stream & uploading to cloud...");

      const res = await fetch("/api/music/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          customTitle: title,
          customArtist: artist,
          playlistId: playlistMode === "EXISTING" ? selectedPlaylistId : undefined,
          newPlaylistTitle: playlistMode === "NEW" ? newPlaylistTitle : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.track) {
        throw new Error(data.error || "Failed extracting audio");
      }

      setExtractionStep("Saving audio file to local device storage...");

      let audioBlob: Blob | undefined;
      if (data.audioBase64 && typeof data.audioBase64 === "string") {
        const binaryStr = atob(data.audioBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        audioBlob = new Blob([bytes], {
          type: data.mimeType || data.track.format || "audio/mp4",
        });
      }

      let trackDuration = Number(data.duration || data.track.duration || 0);
      if (audioBlob && (!trackDuration || trackDuration === 0)) {
        const measured = await extractAudioDuration(audioBlob).catch(() => 0);
        if (measured > 0) trackDuration = measured;
      }

      const serverTrack: MusicTrack = {
        ...data.track,
        duration: trackDuration,
        size: audioBlob ? audioBlob.size : Number(data.size || data.track.size || 0),
        format: data.mimeType || data.track.format || "audio/mp4",
        audioBlob,
        source: "DOWNLOADED",
        downloadStatus: audioBlob ? "DOWNLOADED" : "DOWNLOADING",
        downloadProgress: audioBlob ? 100 : 40,
        addedAt: Date.now(),
      };

      // Dual persistence: save locally to IndexedDB with full audioBlob
      await saveTrack(serverTrack);

      // If audioBase64 wasn't returned, download from stream endpoint and verify
      if (!serverTrack.audioBlob) {
        await downloadTrackToLocalStorage(serverTrack);
        if (serverTrack.audioBlob && (!serverTrack.duration || serverTrack.duration === 0)) {
          const measured = await extractAudioDuration(serverTrack.audioBlob).catch(() => 0);
          if (measured > 0) {
            serverTrack.duration = measured;
            await saveTrack(serverTrack);
          }
        }
      }

      if (!serverTrack.audioBlob || serverTrack.audioBlob.size < 1000) {
        throw new Error("Downloaded audio stream was empty. Please try another YouTube link.");
      }

      // Handle local playlist association
      if (data.playlist) {
        await savePlaylist(data.playlist, false);
      } else if (playlistMode === "EXISTING" && selectedPlaylistId) {
        await addTrackToPlaylist(selectedPlaylistId, serverTrack.id);
      }

      window.dispatchEvent(new Event("lifeatlas_tracks_updated"));
      setExtractedTrack(serverTrack);
      setExtractionStep("Complete!");
      triggerHaptic("success");

      if (onSuccess) {
        onSuccess(serverTrack, data.playlist);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Audio extraction failed";
      setErrorMessage(msg);
      triggerHaptic("error");
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePlayNow = () => {
    triggerHaptic("tap");
    if (extractedTrack) {
      playTrack(extractedTrack, [extractedTrack], {
        type: "LIBRARY",
        title: "YouTube Extracted",
      });
      onClose();
    }
  };

  const handleReset = () => {
    setUrl("");
    setVideoId(null);
    setTitle("");
    setArtist("");
    setThumbnailUrl(null);
    setExtractedTrack(null);
    setErrorMessage(null);
    setNewPlaylistTitle("");
    setPlaylistMode("NONE");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fade-in overflow-x-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yt-modal-title"
      onClick={() => {
        handleReset();
        onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[32px] sm:rounded-3xl bg-white border-t sm:border border-slate-200 shadow-2xl p-5 sm:p-7 space-y-4 relative overflow-x-hidden max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
      >
        {/* Native Mobile Bottom Sheet Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto -mt-1 mb-2 sm:hidden shrink-0" aria-hidden="true" />

        {/* Ambient Top Radiant Wash */}
        <div
          className="absolute -top-20 -right-20 w-56 h-56 bg-red-500/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-xs shrink-0">
              <YoutubeIcon className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 id="yt-modal-title" className="font-display text-lg sm:text-2xl text-slate-900 font-normal">
                Import from YouTube
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Extract high-fidelity audio into your private vault.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic("tap");
              handleReset();
              onClose();
            }}
            className="w-8 h-8 rounded-full glass-card-subtle hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {extractedTrack ? (
          <div className="space-y-4 py-2 animate-fade-in relative z-10 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-display text-lg sm:text-xl text-slate-900 font-normal">
                Audio Extracted Successfully!
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto px-2">
                <span className="font-semibold text-slate-800">{extractedTrack.title}</span> by{" "}
                <span className="font-semibold text-slate-800">{extractedTrack.artist}</span> is now saved in local offline storage and synced to cloud.
              </p>
              <div className="inline-flex items-center gap-2 pt-1 text-[11px] font-mono text-emerald-700 font-semibold">
                <span>Duration: {formatDuration(extractedTrack.duration || 0)}</span>
                <span>•</span>
                <span>Size: {((extractedTrack.size || 0) / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>

            {/* Artwork Card */}
            {thumbnailUrl && (
              <div className="relative w-40 sm:w-48 aspect-video rounded-2xl overflow-hidden mx-auto border border-slate-200 shadow-md">
                <Image
                  src={thumbnailUrl}
                  alt={extractedTrack.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-2.5 pt-2 w-full">
              <button
                onClick={() => {
                  triggerHaptic("tap");
                  handleReset();
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl glass-card-subtle hover:bg-slate-100 text-xs font-sans text-slate-700 hover:text-slate-950 border border-slate-200 transition-colors cursor-pointer active:scale-95 text-center"
              >
                Close & View Vault
              </button>

              <button
                onClick={handlePlayNow}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-sans text-xs font-bold uppercase tracking-wider transition-all neon-glow-amber active:scale-95 cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                <span>Play Now</span>
              </button>
            </div>
          </div>
        ) : (
          /* Input & Extraction Form */
          <form onSubmit={handleExtractAndSave} className="space-y-4 relative z-10 w-full overflow-hidden">
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-sans text-rose-800 flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* YouTube Link Input - Without autoFocus to eliminate mobile horizontal pan */}
            <div className="space-y-1.5 w-full">
              <label htmlFor="yt-url-input" className="text-xs font-semibold text-slate-700 block">
                YouTube Video or Shorts Link:
              </label>
              <div className="relative w-full">
                <input
                  id="yt-url-input"
                  type="text"
                  placeholder="Paste YouTube link here..."
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={isExtracting}
                  className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all font-mono"
                />
                {isLoadingPreview && (
                  <Loader2 className="w-4 h-4 text-red-500 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
                )}
              </div>
            </div>

            {/* Video Preview Stage (if recognized) */}
            {videoId && (
              <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2.5 w-full overflow-hidden animate-fade-in">
                <div className="flex items-center gap-3">
                  {thumbnailUrl && (
                    <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300 shadow-xs">
                      <Image
                        src={thumbnailUrl}
                        alt="Preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Track Title"
                      disabled={isExtracting}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-400 truncate"
                    />
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      placeholder="Artist Name"
                      disabled={isExtracting}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:border-amber-400 truncate"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Playlist Destination Selector */}
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>In which playlist do you want to add this song?</span>
                <span className="text-[10px] font-normal text-slate-400">Optional</span>
              </label>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("tap");
                    setPlaylistMode("NONE");
                  }}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-sans text-[11px] sm:text-xs font-medium ${
                    playlistMode === "NONE"
                      ? "bg-amber-500/15 border-amber-400 text-amber-900 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Library Only
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("tap");
                    setPlaylistMode("EXISTING");
                  }}
                  disabled={playlists.length === 0}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-sans text-[11px] sm:text-xs font-medium disabled:opacity-40 ${
                    playlistMode === "EXISTING"
                      ? "bg-amber-500/15 border-amber-400 text-amber-900 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Existing ({playlists.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("tap");
                    setPlaylistMode("NEW");
                  }}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-sans text-[11px] sm:text-xs font-medium ${
                    playlistMode === "NEW"
                      ? "bg-amber-500/15 border-amber-400 text-amber-900 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  + New Playlist
                </button>
              </div>

              {/* Existing Playlist Dropdown */}
              {playlistMode === "EXISTING" && (
                <div className="pt-1 animate-fade-in">
                  <select
                    value={selectedPlaylistId}
                    onChange={(e) => setSelectedPlaylistId(e.target.value)}
                    disabled={isExtracting}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-amber-400"
                  >
                    {playlists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.title} ({pl.trackIds.length} tracks)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* New Playlist Title Input */}
              {playlistMode === "NEW" && (
                <div className="pt-1 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Enter playlist name..."
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    disabled={isExtracting}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-amber-400 placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>

            {/* Live Progress Info */}
            {isExtracting && (
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs font-mono text-amber-900 space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span className="font-semibold">{extractionStep}</span>
                </div>
                <div className="w-full h-1 bg-amber-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 animate-pulse w-3/4 rounded-full" />
                </div>
              </div>
            )}

            {/* One-Handed Action Buttons Stack */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  handleReset();
                  onClose();
                }}
                disabled={isExtracting}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 text-xs font-semibold font-sans text-slate-600 hover:bg-slate-50 transition-colors text-center cursor-pointer active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!videoId || isExtracting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-sans text-xs font-bold tracking-wide transition-all shadow-md disabled:opacity-40 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4 shrink-0" />
                <span>{isExtracting ? "Extracting..." : "Extract Audio & Add to Vault"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
