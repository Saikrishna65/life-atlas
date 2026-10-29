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
import {
  syncNativeMediaPlayback,
  stopNativeMediaPlayback,
  subscribeNativeMediaActions,
} from "./nativeMediaBridge";

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
  stop: () => void;
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

  // Live refs so background & lock-screen callbacks always read fresh state without stale closures
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<MusicTrack | null>(null);
  const queueRef = useRef<MusicTrack[]>([]);
  const queueIndexRef = useRef<number>(0);
  const repeatModeRef = useRef<RepeatMode>("OFF");
  const sourceContextRef = useRef<PlaybackState["sourceContext"]>(undefined);
  const volumeRef = useRef<number>(1);
  const playbackRateRef = useRef<number>(1);
  const durationRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const activeBlobUrlRef = useRef<string | null>(null);
  const hasIncrementedPlayCountRef = useRef(false);
  const lastNativePositionSyncRef = useRef<number>(0);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);
  useEffect(() => {
    sourceContextRef.current = sourceContext;
  }, [sourceContext]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const pushNativeState = useCallback(
    (override?: Partial<{ track: MusicTrack | null; playing: boolean; posSec: number; durSec: number; rate: number }>) => {
      const track = override && "track" in override ? override.track : currentTrackRef.current;
      if (!track) return;
      const audio = audioRef.current;
      const playing = override?.playing ?? isPlayingRef.current;
      const posSec = override?.posSec ?? (audio ? audio.currentTime : 0);
      const rawDur =
        override?.durSec ??
        ((audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : durationRef.current) ||
          track.duration ||
          0);
      const rate = override?.rate ?? playbackRateRef.current;

      lastNativePositionSyncRef.current = Date.now();
      syncNativeMediaPlayback({
        title: track.title,
        artist: track.artist,
        album: track.album || "Atlas Music Vault",
        artworkUrl: track.artworkUrl,
        isPlaying: playing,
        positionMs: posSec * 1000,
        durationMs: rawDur * 1000,
        playbackRate: rate,
      });
    },
    []
  );

  // Initialize Audio element once (never recreate on currentTrack change!)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const activeTrack = currentTrackRef.current;
      if (
        !hasIncrementedPlayCountRef.current &&
        audio.currentTime > 15 &&
        activeTrack
      ) {
        hasIncrementedPlayCountRef.current = true;
        incrementPlayCount(activeTrack.id).catch(() => {});
      }

      // Periodically sync position with native Android MediaSession every 5s while playing
      if (activeTrack && !audio.paused && Date.now() - lastNativePositionSyncRef.current > 5000) {
        pushNativeState({ playing: true, posSec: audio.currentTime });
      }
    };

    const handleDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const roundedDuration = Math.round(audio.duration);
        durationRef.current = audio.duration;
        setDuration(audio.duration);
        const activeTrack = currentTrackRef.current;
        if (activeTrack) {
          pushNativeState({ durSec: audio.duration });
          if ((!activeTrack.duration || activeTrack.duration === 0) && roundedDuration > 0) {
            const updatedTrack = { ...activeTrack, duration: roundedDuration };
            currentTrackRef.current = updatedTrack;
            setCurrentTrack(updatedTrack);
            getTrack(activeTrack.id)
              .then((stored) => {
                if (stored && (!stored.duration || stored.duration === 0)) {
                  return saveTrack({ ...stored, duration: roundedDuration });
                }
              })
              .catch(() => {});
          }
        }
      }
    };

    const handlePlay = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
      pushNativeState({ playing: true, posSec: audio.currentTime });
    };

    const handlePause = () => {
      // Note: HTMLAudioElement fires 'pause' right before 'ended'; let 'ended' advance to next track seamlessly
      if (audio.ended) return;
      isPlayingRef.current = false;
      setIsPlaying(false);
      pushNativeState({ playing: false, posSec: audio.currentTime });
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      isPlayingRef.current = true;
      setIsPlaying(true);
      pushNativeState({ playing: true, posSec: audio.currentTime });
    };

    const handleError = () => {
      setIsBuffering(false);
      isPlayingRef.current = false;
      setIsPlaying(false);
      pushNativeState({ playing: false });
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
      stopNativeMediaPlayback();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("error", handleError);
    };
  }, [pushNativeState]);

  const downloadTrack = useCallback(async (track: MusicTrack): Promise<void> => {
    const downloadSrc = track.audioUrl || track.streamUrl || `/api/music/stream/${track.id}`;
    if (!downloadSrc) return;

    try {
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

      if (currentTrackRef.current?.id === track.id) {
        setCurrentTrack({ ...track });
      }
      setQueue((prev) =>
        prev.map((t) => (t.id === track.id ? { ...track } : t))
      );
    } catch {
      track.downloadStatus = "FAILED";
      await saveTrack(track);
      setError("Download failed. Verify internet connection.");
    }
  }, []);

  // Core Play Track Function
  const playTrack = useCallback(
    async (
      track: MusicTrack,
      newQueue?: MusicTrack[],
      context?: PlaybackState["sourceContext"]
    ) => {
      const audio = audioRef.current;
      if (!audio) return;

      setError(null);
      hasIncrementedPlayCountRef.current = false;
      currentTrackRef.current = track;
      setCurrentTrack(track);
      durationRef.current = track.duration || 0;
      setDuration(track.duration || 0);
      setCurrentTime(0);

      if (context) {
        sourceContextRef.current = context;
        setSourceContext(context);
      }

      if (newQueue && newQueue.length > 0) {
        queueRef.current = newQueue;
        setQueue(newQueue);
        const foundIdx = newQueue.findIndex((t) => t.id === track.id);
        const nextIdx = foundIdx >= 0 ? foundIdx : 0;
        queueIndexRef.current = nextIdx;
        setQueueIndex(nextIdx);
      }

      // Immediately activate native foreground MediaSession before async IndexedDB read
      // so pressing Home / Lock immediately keeps WebView audio awake!
      pushNativeState({
        track,
        playing: true,
        posSec: 0,
        durSec: track.duration || 0,
      });

      // Clean up previous blob URL
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }

      let audioSrc: string | null = null;

      if (track.audioBlob && track.audioBlob.size > 2500) {
        audioSrc = URL.createObjectURL(track.audioBlob);
        activeBlobUrlRef.current = audioSrc;
      } else {
        try {
          const stored = await getTrack(track.id);
          if (stored?.audioBlob && stored.audioBlob.size > 2500) {
            audioSrc = URL.createObjectURL(stored.audioBlob);
            activeBlobUrlRef.current = audioSrc;
          }
        } catch {
          // Fall back to stream
        }
      }

      if (!audioSrc && track.id.startsWith("trk_yt_")) {
        audioSrc = `/api/music/stream/${track.id}`;
        downloadTrack(track).catch(() => {});
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
        isPlayingRef.current = false;
        setIsPlaying(false);
        pushNativeState({ track, playing: false, posSec: 0 });
        setError("No playable audio source found for this track.");
        return;
      }

      try {
        audio.src = audioSrc;
        audio.playbackRate = playbackRateRef.current;
        audio.volume = volumeRef.current;
        await audio.play();
        isPlayingRef.current = true;
        setIsPlaying(true);
        pushNativeState({
          track,
          playing: true,
          posSec: audio.currentTime,
          durSec:
            (Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.duration
              : track.duration) || 0,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Playback blocked or failed";
        console.warn("Audio play error:", message);
        isPlayingRef.current = false;
        setIsPlaying(false);
        pushNativeState({ track, playing: false, posSec: 0 });
        setError("Playback paused or interrupted. Tap to resume.");
      }
    },
    [downloadTrack, pushNativeState]
  );

  // Next Track Logic (reads live refs so lock-screen & background auto-advance never use stale closures)
  const nextTrack = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const rep = repeatModeRef.current;
    const ctx = sourceContextRef.current;

    if (q.length === 0) return;

    if (rep === "ONE" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      pushNativeState({ playing: true, posSec: 0 });
      return;
    }

    let nextIdx = idx + 1;
    if (nextIdx >= q.length) {
      if (rep === "ALL") {
        nextIdx = 0;
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
        pushNativeState({ playing: false, posSec: 0 });
        return;
      }
    }

    queueIndexRef.current = nextIdx;
    setQueueIndex(nextIdx);
    const track = q[nextIdx];
    if (track) {
      playTrack(track, q, ctx);
    }
  }, [playTrack, pushNativeState]);

  // Previous Track Logic
  const previousTrack = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const rep = repeatModeRef.current;
    const ctx = sourceContextRef.current;
    const audio = audioRef.current;

    if (q.length === 0) return;

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      pushNativeState({ posSec: 0 });
      return;
    }

    let prevIdx = idx - 1;
    if (prevIdx < 0) {
      prevIdx = rep === "ALL" ? q.length - 1 : 0;
    }

    queueIndexRef.current = prevIdx;
    setQueueIndex(prevIdx);
    const track = q[prevIdx];
    if (track) {
      playTrack(track, q, ctx);
    }
  }, [playTrack, pushNativeState]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    stopNativeMediaPlayback();
  }, []);

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

  // Subscribe to Native Android Lock-Screen & Notification MediaSession actions
  useEffect(() => {
    return subscribeNativeMediaActions((event) => {
      const audio = audioRef.current;
      if (!audio) return;

      switch (event.action) {
        case "play":
          audio.play().catch(() => {});
          break;
        case "pause":
          audio.pause();
          break;
        case "toggle":
          if (audio.paused) {
            audio.play().catch(() => {});
          } else {
            audio.pause();
          }
          break;
        case "next":
          nextTrack();
          break;
        case "previous":
          previousTrack();
          break;
        case "seek":
          if (typeof event.positionMs === "number" && event.positionMs >= 0) {
            const secs = event.positionMs / 1000;
            audio.currentTime = secs;
            setCurrentTime(secs);
            pushNativeState({ posSec: secs });
          }
          break;
        case "duck":
          audio.volume = Math.max(0.1, volumeRef.current * 0.25);
          break;
        case "unduck":
          audio.volume = volumeRef.current;
          break;
        case "stop":
          audio.pause();
          isPlayingRef.current = false;
          setIsPlaying(false);
          break;
        default:
          break;
      }
    });
  }, [nextTrack, previousTrack, pushNativeState]);

  // Update Web MediaSession API (for desktop / Chrome browsers)
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

  // Setup Web MediaSession action handlers
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
        setCurrentTime(details.seekTime);
        pushNativeState({ posSec: details.seekTime });
      }
    });

    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const skipTime = details.seekOffset || 10;
      if (audioRef.current) {
        const nextPos = Math.max(audioRef.current.currentTime - skipTime, 0);
        audioRef.current.currentTime = nextPos;
        pushNativeState({ posSec: nextPos });
      }
    });

    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const skipTime = details.seekOffset || 10;
      if (audioRef.current) {
        const nextPos = Math.min(
          audioRef.current.currentTime + skipTime,
          audioRef.current.duration || 0
        );
        audioRef.current.currentTime = nextPos;
        pushNativeState({ posSec: nextPos });
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
  }, [nextTrack, previousTrack, pushNativeState]);

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
    pushNativeState({ posSec: seconds });
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const setPlaybackRate = (rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    playbackRateRef.current = clamped;
    setPlaybackRateState(clamped);
    if (audioRef.current) {
      audioRef.current.playbackRate = clamped;
    }
    pushNativeState({ rate: clamped });
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
    if (!isShuffle && queue.length > 1) {
      const remaining = [...queue.slice(queueIndex + 1)].sort(() => Math.random() - 0.5);
      const newQueue = [...queue.slice(0, queueIndex + 1), ...remaining];
      queueRef.current = newQueue;
      setQueue(newQueue);
    }
  };

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      const next = prev === "OFF" ? "ALL" : prev === "ALL" ? "ONE" : "OFF";
      repeatModeRef.current = next;
      return next;
    });
  };

  const addToQueue = (track: MusicTrack) => {
    setQueue((prev) => {
      const next = [...prev, track];
      queueRef.current = next;
      return next;
    });
  };

  const playNext = (track: MusicTrack) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(queueIndexRef.current + 1, 0, track);
      queueRef.current = copy;
      return copy;
    });
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      queueRef.current = copy;
      return copy;
    });
    if (index < queueIndexRef.current) {
      queueIndexRef.current = Math.max(0, queueIndexRef.current - 1);
      setQueueIndex(queueIndexRef.current);
    }
  };

  const reorderQueue = (newQueue: MusicTrack[]) => {
    queueRef.current = newQueue;
    setQueue(newQueue);
    if (currentTrack) {
      const newIdx = newQueue.findIndex((t) => t.id === currentTrack.id);
      if (newIdx >= 0) {
        queueIndexRef.current = newIdx;
        setQueueIndex(newIdx);
      }
    }
  };

  const clearQueue = () => {
    if (currentTrack) {
      queueRef.current = [currentTrack];
      queueIndexRef.current = 0;
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      queueRef.current = [];
      queueIndexRef.current = 0;
      setQueue([]);
      setQueueIndex(0);
      stopNativeMediaPlayback();
    }
  };

  const toggleFavorite = async (trackId: string): Promise<boolean> => {
    const isFav = await toggleFavoriteTrack(trackId);
    if (currentTrack && currentTrack.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: isFav } : null));
    }
    setQueue((prev) => {
      const next = prev.map((t) => (t.id === trackId ? { ...t, isFavorite: isFav } : t));
      queueRef.current = next;
      return next;
    });
    return isFav;
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
      setQueue((prev) => {
        const next = prev.map((t) => (t.id === trackId ? { ...track } : t));
        queueRef.current = next;
        return next;
      });
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
        stop,
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
