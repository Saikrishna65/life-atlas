"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import {
  MusicTrack,
  PlaybackState,
  RepeatMode,
} from "./types";
import {
  getTrack,
  saveTrack,
  incrementPlayCount,
  toggleFavoriteTrack,
} from "./storage";

interface MusicPlayerContextValue extends PlaybackState {
  isNowPlayingOpen: boolean;
  setIsNowPlayingOpen: (open: boolean) => void;
  playTrack: (
    track: MusicTrack,
    newQueue?: MusicTrack[],
    context?: PlaybackState["sourceContext"]
  ) => Promise<void>;
  togglePlayPause: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  addToQueue: (track: MusicTrack) => void;
  playNext: (track: MusicTrack) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (newQueue: MusicTrack[]) => void;
  clearQueue: () => void;
  toggleFavorite: (trackId: string) => Promise<boolean>;
  downloadTrack: (track: MusicTrack) => Promise<void>;
  deleteDownloadedCopy: (trackId: string) => Promise<void>;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("OFF");
  const [isShuffle, setIsShuffle] = useState(false);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sourceContext, setSourceContext] = useState<PlaybackState["sourceContext"]>(undefined);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);

  // Audio HTML element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const hasIncrementedPlayCountRef = useRef(false);

  // Initialize Audio element once
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (
        !hasIncrementedPlayCountRef.current &&
        audio.currentTime > 15 &&
        currentTrack
      ) {
        hasIncrementedPlayCountRef.current = true;
        incrementPlayCount(currentTrack.id).catch(() => {});
      }
    };

    const handleDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setError("Unable to play track. File may be unavailable or network offline.");
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("error", handleError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("error", handleError);
    };
  }, [currentTrack]);

  // Audio focus / visibility change handling
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      // In mobile webview, keep playing in background unless audio focus lost
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Update MediaSession API for Android Lockscreen and Media Notification
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !currentTrack) {
      return;
    }

    try {
      const artwork = currentTrack.artworkUrl
        ? [
            {
              src: currentTrack.artworkUrl,
              sizes: "512x512",
              type: "image/jpeg",
            },
          ]
        : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || "Life Atlas Music Vault",
        artwork,
      });

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      if (Number.isFinite(duration) && duration > 0) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: Math.min(currentTime, duration),
        });
      }
    } catch {
      // Ignore media session errors on unsupported browsers
    }
  }, [currentTrack, isPlaying, duration, currentTime, playbackRate]);

  // Next Track Logic
  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;

    if (repeatMode === "ONE" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      return;
    }

    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === "ALL") {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    setQueueIndex(nextIdx);
    const track = queue[nextIdx];
    if (track) {
      playTrack(track, queue, sourceContext);
    }
  }, [queue, queueIndex, repeatMode, sourceContext]);

  // Previous Track Logic
  const previousTrack = useCallback(() => {
    if (queue.length === 0) return;

    // If more than 3 seconds in, restart track
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = repeatMode === "ALL" ? queue.length - 1 : 0;
    }

    setQueueIndex(prevIdx);
    const track = queue[prevIdx];
    if (track) {
      playTrack(track, queue, sourceContext);
    }
  }, [queue, queueIndex, currentTime, repeatMode, sourceContext]);

  // Audio onEnded event handler
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      nextTrack();
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [nextTrack]);

  // Setup MediaSession action handlers
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play().catch(() => {});
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      nextTrack();
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      previousTrack();
    });

    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (typeof details.seekTime === "number" && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
      }
    });

    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const skipTime = details.seekOffset || 10;
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(audioRef.current.currentTime - skipTime, 0);
      }
    });

    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const skipTime = details.seekOffset || 10;
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(
          audioRef.current.currentTime + skipTime,
          audioRef.current.duration || 0
        );
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    };
  }, [nextTrack, previousTrack]);

  // Core Play Track Function
  const playTrack = async (
    track: MusicTrack,
    newQueue?: MusicTrack[],
    context?: PlaybackState["sourceContext"]
  ) => {
    const audio = audioRef.current;
    if (!audio) return;

    setError(null);
    hasIncrementedPlayCountRef.current = false;
    setCurrentTrack(track);

    if (context) {
      setSourceContext(context);
    }

    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const foundIdx = newQueue.findIndex((t) => t.id === track.id);
      setQueueIndex(foundIdx >= 0 ? foundIdx : 0);
    }

    // Clean up previous blob URL
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }

    // Determine playback audio source:
    // 1. If track has audioBlob (or cached in DB), use Blob URL
    // 2. If track is remote stream, use streamUrl
    let audioSrc: string | null = null;

    if (track.audioBlob) {
      audioSrc = URL.createObjectURL(track.audioBlob);
      activeBlobUrlRef.current = audioSrc;
    } else {
      // Check if blob is stored in IndexedDB
      try {
        const stored = await getTrack(track.id);
        if (stored?.audioBlob) {
          audioSrc = URL.createObjectURL(stored.audioBlob);
          activeBlobUrlRef.current = audioSrc;
        }
      } catch {
        // Fall back to stream
      }
    }

    if (!audioSrc && track.audioUrl) {
      audioSrc = track.audioUrl;
    }

    if (!audioSrc && track.streamUrl) {
      audioSrc = track.streamUrl;
    }

    if (!audioSrc && track.id) {
      audioSrc = `/api/music/stream/${track.id}`;
    }

    if (!audioSrc) {
      setError("No playable audio source found for this track.");
      return;
    }

    try {
      audio.src = audioSrc;
      audio.playbackRate = playbackRate;
      audio.volume = volume;
      await audio.play();
      setIsPlaying(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Playback blocked or failed";
      console.warn("Audio play error:", message);
      setIsPlaying(false);
      setError("Playback paused or interrupted. Tap to resume.");
    }
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const pause = () => {
    audioRef.current?.pause();
  };

  const resume = () => {
    audioRef.current?.play().catch(() => {});
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const setPlaybackRate = (rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    setPlaybackRateState(clamped);
    if (audioRef.current) {
      audioRef.current.playbackRate = clamped;
    }
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
    // When enabled, randomize remaining queue
    if (!isShuffle && queue.length > 1) {
      const remaining = [...queue.slice(queueIndex + 1)].sort(() => Math.random() - 0.5);
      const newQueue = [...queue.slice(0, queueIndex + 1), ...remaining];
      setQueue(newQueue);
    }
  };

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "OFF") return "ALL";
      if (prev === "ALL") return "ONE";
      return "OFF";
    });
  };

  const addToQueue = (track: MusicTrack) => {
    setQueue((prev) => [...prev, track]);
  };

  const playNext = (track: MusicTrack) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(queueIndex + 1, 0, track);
      return copy;
    });
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
    if (index < queueIndex) {
      setQueueIndex((prev) => prev - 1);
    }
  };

  const reorderQueue = (newQueue: MusicTrack[]) => {
    setQueue(newQueue);
    if (currentTrack) {
      const newIdx = newQueue.findIndex((t) => t.id === currentTrack.id);
      if (newIdx >= 0) setQueueIndex(newIdx);
    }
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(0);
    }
  };

  const toggleFavorite = async (trackId: string): Promise<boolean> => {
    const isFav = await toggleFavoriteTrack(trackId);
    if (currentTrack && currentTrack.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: isFav } : null));
    }
    setQueue((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: isFav } : t))
    );
    return isFav;
  };

  const downloadTrack = async (track: MusicTrack): Promise<void> => {
    const downloadSrc = track.audioUrl || track.streamUrl || `/api/music/stream/${track.id}`;
    if (!downloadSrc) return;

    try {
      // Update state to downloading
      track.downloadStatus = "DOWNLOADING";
      track.downloadProgress = 15;
      await saveTrack(track);

      const response = await fetch(downloadSrc);
      if (!response.ok) throw new Error("Audio download failed");

      const blob = await response.blob();
      track.audioBlob = blob;
      track.source = "DOWNLOADED";
      track.size = blob.size;
      track.downloadStatus = "DOWNLOADED";
      track.downloadProgress = 100;

      await saveTrack(track);

      // Update current and queue track reference
      if (currentTrack?.id === track.id) {
        setCurrentTrack({ ...track });
      }
      setQueue((prev) =>
        prev.map((t) => (t.id === track.id ? { ...track } : t))
      );
    } catch (err: unknown) {
      track.downloadStatus = "FAILED";
      await saveTrack(track);
      setError("Download failed. Verify internet connection.");
    }
  };

  const deleteDownloadedCopy = async (trackId: string): Promise<void> => {
    const track = await getTrack(trackId);
    if (!track) return;

    if (track.source === "DOWNLOADED" && (track.streamUrl || track.audioUrl)) {
      delete track.audioBlob;
      track.source = "STREAM";
      track.downloadStatus = "IDLE";
      track.downloadProgress = 0;
      await saveTrack(track);

      if (currentTrack?.id === trackId) {
        setCurrentTrack({ ...track });
      }
      setQueue((prev) =>
        prev.map((t) => (t.id === trackId ? { ...track } : t))
      );
    }
  };

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        isMuted,
        playbackRate,
        repeatMode,
        isShuffle,
        queue,
        queueIndex,
        error,
        sourceContext,
        isNowPlayingOpen,
        setIsNowPlayingOpen,
        playTrack,
        togglePlayPause,
        pause,
        resume,
        nextTrack,
        previousTrack,
        seek,
        setVolume,
        setPlaybackRate,
        toggleShuffle,
        cycleRepeatMode,
        addToQueue,
        playNext,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        toggleFavorite,
        downloadTrack,
        deleteDownloadedCopy,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return ctx;
}
