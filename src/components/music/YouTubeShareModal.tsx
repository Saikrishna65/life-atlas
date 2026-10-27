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
import { extractYouTubeVideoId, parseYouTubeTitle } from "@/lib/music/youtubeExtractor";
import { saveTrack, getAllPlaylists, savePlaylist, addTrackToPlaylist } from "@/lib/music/storage";
import { downloadTrackToLocalStorage } from "@/lib/music/cloudSync";
import { MusicTrack, MusicPlaylist } from "@/lib/music/types";
import { useMusicPlayer } from "@/lib/music/MusicPlayerContext";

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
    if (initialUrl) {
      handleUrlChange(initialUrl);
    }
  }, [initialUrl, handleUrlChange]);

  // Extract Audio & Save
  const handleExtractAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const serverTrack: MusicTrack = {
        ...data.track,
        source: "DOWNLOADED",
        downloadStatus: "DOWNLOADING",
        downloadProgress: 40,
        addedAt: Date.now(),
      };

      setExtractionStep("Saving to local offline storage...");

      // Dual persistence: save locally to IndexedDB
      await saveTrack(serverTrack);

      // Download audio blob to local storage so it's instantly offline-ready
      try {
        await downloadTrackToLocalStorage(serverTrack);
      } catch (blobErr) {
        console.warn("Local blob caching deferred:", blobErr);
      }

      // Handle local playlist association
      if (data.playlist) {
        await savePlaylist(data.playlist, false);
      } else if (playlistMode === "EXISTING" && selectedPlaylistId) {
        await addTrackToPlaylist(selectedPlaylistId, serverTrack.id);
      }

      setExtractedTrack(serverTrack);
      setExtractionStep("Complete!");

      if (onSuccess) {
        onSuccess(serverTrack, data.playlist);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Audio extraction failed";
      setErrorMessage(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePlayNow = () => {
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
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yt-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-up relative overflow-hidden"
      >
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
              <h3 id="yt-modal-title" className="font-display text-xl sm:text-2xl text-slate-900 font-normal">
                Import from YouTube
              </h3>
              <p className="text-xs text-slate-500">
                Extract high-fidelity audio from any YouTube video into your private vault.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="w-8 h-8 rounded-full glass-card-subtle hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {extractedTrack ? (
          <div className="space-y-5 py-2 animate-fade-in relative z-10 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-display text-xl text-slate-900 font-normal">
                Audio Extracted Successfully!
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                <span className="font-semibold text-slate-800">{extractedTrack.title}</span> by{" "}
                <span className="font-semibold text-slate-800">{extractedTrack.artist}</span> has been saved in both your local offline storage and online database.
              </p>
            </div>

            {/* Artwork Card */}
            {thumbnailUrl && (
              <div className="relative w-44 aspect-video rounded-2xl overflow-hidden mx-auto border border-slate-200 shadow-md">
                <Image
                  src={thumbnailUrl}
                  alt={extractedTrack.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handlePlayNow}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-sans text-xs font-bold uppercase tracking-wider transition-all neon-glow-amber active:scale-95 cursor-pointer shadow-lg"
              >
                <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                <span>Play Now</span>
              </button>

              <button
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl glass-card-subtle hover:bg-slate-100 text-xs font-sans text-slate-700 hover:text-slate-950 border border-slate-200 transition-colors cursor-pointer"
              >
                Close & View Vault
              </button>
            </div>
          </div>
        ) : (
          /* Input & Extraction Form */
          <form onSubmit={handleExtractAndSave} className="space-y-4 relative z-10">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-sans text-rose-800 flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* YouTube Link Input */}
            <div className="space-y-1.5">
              <label htmlFor="yt-url-input" className="text-xs font-semibold text-slate-700 block">
                YouTube Video or Shorts Link:
              </label>
              <div className="relative">
                <input
                  id="yt-url-input"
                  type="text"
                  placeholder="https://youtu.be/... or https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={isExtracting}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all font-mono"
                  autoFocus
                />
                {isLoadingPreview && (
                  <Loader2 className="w-4 h-4 text-red-500 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
                )}
              </div>
            </div>

            {/* Video Preview Stage (if recognized) */}
            {videoId && (
              <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
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
                  <div className="min-w-0 flex-1 space-y-1">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Track Title"
                      disabled={isExtracting}
                      className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      placeholder="Artist Name"
                      disabled={isExtracting}
                      className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:border-amber-400"
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

              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPlaylistMode("NONE")}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-sans ${
                    playlistMode === "NONE"
                      ? "bg-amber-500/15 border-amber-400 text-amber-900 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Library Only
                </button>

                <button
                  type="button"
                  onClick={() => setPlaylistMode("EXISTING")}
                  disabled={playlists.length === 0}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-sans disabled:opacity-40 ${
                    playlistMode === "EXISTING"
                      ? "bg-amber-500/15 border-amber-400 text-amber-900 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Existing ({playlists.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPlaylistMode("NEW")}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-sans ${
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
                <div className="pt-1.5 animate-fade-in">
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
                <div className="pt-1.5 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Enter new playlist name (e.g. Desert Highway Tunes)..."
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
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs font-mono text-amber-900 space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span className="font-semibold">{extractionStep}</span>
                </div>
                <div className="w-full h-1 bg-amber-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 animate-pulse w-3/4 rounded-full" />
                </div>
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                disabled={isExtracting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-sans text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!videoId || isExtracting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-sans text-xs font-bold tracking-wide transition-all shadow-md disabled:opacity-40 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>{isExtracting ? "Extracting..." : "Extract Audio & Add to Vault"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
